import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, setDoc, updateDoc, query, collectionData, serverTimestamp, orderBy, where, getDocs, collectionGroup, writeBatch, onSnapshot } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Observable, combineLatest, map, of, Subscription, BehaviorSubject } from 'rxjs';
import { InvoiceService, Invoice } from './invoice.service';
import { ToastService } from './toast.service';
import { AssetsService } from './assets.service';
import { UserService } from './user.service';

export interface Message {
    text: string;
    timestamp: any;
    read: boolean;
    senderId: string;
    recipientId: string;
    type?: 'text' | 'invoice' | 'asset';
    invoiceData?: Invoice;
    assetId?: string;
}

export interface Conversation {
    userId: string;
    userName: string;
    userAvatar?: string;
    lastMessage?: string;
    lastMessageTime?: any;
    unreadCount?: number;
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private invoiceService = inject(InvoiceService);
    private toastService = inject(ToastService);
    private assetsService = inject(AssetsService);
    private userService = inject(UserService);
    private invoiceSubscription?: Subscription;
    private assetSubscription?: Subscription;

    private unreadMessagesSubject = new BehaviorSubject<Message[]>([]);
    public unreadMessages$ = this.unreadMessagesSubject.asObservable();
    private unreadListenerUnsubscribe: (() => void) | undefined;

    constructor(
        private firestore: Firestore,
        private auth: Auth
    ) {
        // Initialize realtime listener when user logs in
        onAuthStateChanged(this.auth, async (user) => {
            if (user) {
                this.startInvoiceListener(user.uid);
                this.startUnreadListener(user.uid);

                // Check role for asset listener (Admins/Agents only)
                try {
                    const profile = await this.userService.getUserProfile(user.uid);
                    if (profile && (profile['role'] === 'admin' || profile['role'] === 'agent')) {
                        this.startAssetListener(user.uid);
                    }
                } catch (e) {
                    console.error('Error checking role for notifications', e);
                }
            } else {
                this.stopInvoiceListener();
                this.stopUnreadListener();
                this.stopAssetListener();
            }
        });
    }

    /**
     * Send a message to another user
     * Creates entries in both sender's sent and recipient's received collections
     */
    async sendMessage(toUserId: string, messageText: string): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            throw new Error('User must be logged in to send messages');
        }

        const message: Message = {
            text: messageText,
            timestamp: new Date().toISOString(),
            read: false,
            senderId: currentUser.uid,
            recipientId: toUserId
        };

        try {
            // Add to sender's sent subcollection
            const senderSentRef = collection(
                this.firestore,
                'notifications',
                currentUser.uid,
                'sent',
                toUserId,
                'messages'
            );
            await addDoc(senderSentRef, message);

            // Add to recipient's received subcollection
            const recipientReceivedRef = collection(
                this.firestore,
                'notifications',
                toUserId,
                'received',
                currentUser.uid,
                'messages'
            );
            await addDoc(recipientReceivedRef, message);

            console.log('Message sent successfully');
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    /**
     * Stops the invoice listener subscription
     */
    private stopInvoiceListener() {
        if (this.invoiceSubscription) {
            this.invoiceSubscription.unsubscribe();
            this.invoiceSubscription = undefined;
        }
    }

    private stopAssetListener() {
        if (this.assetSubscription) {
            this.assetSubscription.unsubscribe();
            this.assetSubscription = undefined;
        }
    }

    /**
     * Stops the unread messages listener
     */
    private stopUnreadListener() {
        if (this.unreadListenerUnsubscribe) {
            this.unreadListenerUnsubscribe();
            this.unreadListenerUnsubscribe = undefined;
        }
        this.unreadMessagesSubject.next([]);
    }

    /**
     * Realtime listener for ALL unread messages (including system).
     * Updates the central BehaviorSubject.
     */
    private startUnreadListener(userId: string) {
        this.stopUnreadListener();

        const messagesGroupRef = collectionGroup(this.firestore, 'messages');
        const q = query(messagesGroupRef,
            where('recipientId', '==', userId),
            where('read', '==', false)
        );

        let isFirstRun = true;

        this.unreadListenerUnsubscribe = onSnapshot(q, (snapshot) => {
            const messages: Message[] = [];
            snapshot.docs.forEach(doc => {
                // Filter to ensure we only count messages in the 'received' subcollection
                // This avoids counting the sender's copy of the message which also matches the query
                if (doc.ref.path.includes('/received/')) {
                    messages.push(doc.data() as Message);
                }
            });
            this.unreadMessagesSubject.next(messages);

            // Notify user of new messages (skipping the initial load of existing messages)
            if (!isFirstRun) {
                snapshot.docChanges().forEach(async change => {
                    if (change.type === 'added') {
                        const msg = change.doc.data() as Message;
                        if (change.doc.ref.path.includes('/received/')) {
                            let senderName: string | undefined;
                            if (msg.senderId !== 'system') {
                                try {
                                    const profile = await this.userService.getUserProfile(msg.senderId);
                                    senderName = profile?.['displayName'] || profile?.['email'];
                                } catch (e) {
                                    console.error('Error resolving sender name for toast', e);
                                }
                            }
                            this.toastService.showNotification(msg.senderId, msg.text, senderName);
                        }
                    }
                });
            }
            isFirstRun = false;
        }, error => {
            console.error('Error in unread listener:', error);
        });
    }

    /**
     * Realtime listener for proforma invoices.
     * Automatically creates notifications when new invoices appear.
     */
    private startInvoiceListener(userId: string) {
        this.stopInvoiceListener(); // Ensure no duplicate subscriptions

        // Use the local method that queries the nested structure (proforma & receipt)
        this.invoiceSubscription = this.getProformaInvoices(userId).subscribe(async invoices => {
            if (!invoices || invoices.length === 0) return;

            // Get existing system messages to avoid duplicates
            const systemRef = collection(this.firestore, 'notifications', userId, 'received', 'system', 'messages');
            const snapshot = await getDocs(systemRef);
            const existingInvoiceIds = new Set(snapshot.docs.map(d => d.id));

            const batch = writeBatch(this.firestore);
            let batchCount = 0;

            invoices.forEach(inv => {
                // Use invoice ID as the document ID to ensure idempotency
                if (inv.id && !existingInvoiceIds.has(inv.id)) {
                    const docRef = doc(this.firestore, 'notifications', userId, 'received', 'system', 'messages', inv.id);

                    let ts = inv.createdAt;
                    if (ts && typeof ts.toDate === 'function') {
                        ts = ts.toDate().toISOString();
                    } else if (!ts) {
                        ts = new Date().toISOString();
                    }

                    // Determine message text based on type
                    const typeLabel = inv.invoiceType === 'receipt' ? 'Receipt' : 'Proforma Invoice';

                    const message: Message = {
                        text: `New ${typeLabel}: ${inv.assetName || 'Unknown Asset'}`,
                        timestamp: ts,
                        read: false, // Default to unread so user sees it
                        senderId: 'system',
                        recipientId: userId,
                        type: 'invoice',
                        invoiceData: inv
                    };

                    batch.set(docRef, message);
                    batchCount++;
                }
            });

            if (batchCount > 0) {
                await batch.commit();
                console.log(`Synced ${batchCount} system notifications`);
            }
        });
    }

    /**
     * Realtime listener for newly registered assets.
     * Notifies admins/agents when a pending asset has documents uploaded.
     */
    private startAssetListener(userId: string) {
        this.stopAssetListener();

        this.assetSubscription = this.assetsService.getAllVehicles().subscribe(async vehicles => {
            const oneWeekAgo = new Date();
            oneWeekAgo.setHours(oneWeekAgo.getHours() - 168);

            // Filter for pending assets that have recent documents
            const pendingAssets = vehicles.filter(asset => {
                if (asset.status !== 'Pending') return false;
                if (!asset.documents || asset.documents.length === 0) return false;

                // Check if any document is recent
                return asset.documents.some((doc: any) => {
                    const uploadDate = doc.uploadedAt ? new Date(doc.uploadedAt) : null;
                    return uploadDate && uploadDate > oneWeekAgo;
                });
            });

            if (pendingAssets.length === 0) return;

            const systemRef = collection(this.firestore, 'notifications', userId, 'received', 'system', 'messages');
            const snapshot = await getDocs(systemRef);
            const existingIds = new Set(snapshot.docs.map(d => d.id));

            const batch = writeBatch(this.firestore);
            let count = 0;

            pendingAssets.forEach(asset => {
                if (asset.id && !existingIds.has(asset.id)) {
                    const docRef = doc(this.firestore, 'notifications', userId, 'received', 'system', 'messages', asset.id);
                    const message: Message = {
                        text: `New Asset Registration: ${asset.year} ${asset.make} (${asset.numberPlate})`,
                        timestamp: new Date().toISOString(),
                        read: false,
                        senderId: 'system',
                        recipientId: userId,
                        type: 'asset',
                        assetId: asset.id
                    };
                    batch.set(docRef, message);
                    count++;
                }
            });

            if (count > 0) {
                await batch.commit();
                console.log(`Synced ${count} asset notifications`);
            }
        });
    }

    /**
     * Get conversation with a specific user (merge sent and received messages)
     */
    getConversation(otherUserId: string): Observable<Message[]> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            return new Observable(observer => observer.next([]));
        }

        // Get sent messages to this user
        const sentRef = collection(
            this.firestore,
            'notifications',
            currentUser.uid,
            'sent',
            otherUserId,
            'messages'
        );
        const sentQuery = query(sentRef, orderBy('timestamp', 'asc'));
        const sent$ = collectionData(sentQuery, { idField: 'id' }) as Observable<Message[]>;

        // Get received messages from this user
        const receivedRef = collection(
            this.firestore,
            'notifications',
            currentUser.uid,
            'received',
            otherUserId,
            'messages'
        );
        const receivedQuery = query(receivedRef, orderBy('timestamp', 'asc'));
        const received$ = collectionData(receivedQuery, { idField: 'id' }) as Observable<Message[]>;

        // Combine and sort by timestamp
        return combineLatest([sent$, received$]).pipe(
            map(([sent, received]) => {
                const allMessages = [...sent, ...received];
                return allMessages.sort((a, b) => {
                    const timeA = new Date(a.timestamp).getTime();
                    const timeB = new Date(b.timestamp).getTime();
                    return timeA - timeB;
                });
            })
        );
    }

    /**
     * Get list of all conversations (users with messages)
     */
    async getConversationsList(): Promise<Conversation[]> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            return [];
        }

        const conversations: Conversation[] = [];
        const userIds = new Set<string>();

        try {
            // Get all sent conversations
            const sentRef = collection(this.firestore, 'notifications', currentUser.uid, 'sent');
            const sentSnapshot = await getDocs(sentRef);
            sentSnapshot.forEach(doc => {
                userIds.add(doc.id);
            });

            // Get all received conversations
            const receivedRef = collection(this.firestore, 'notifications', currentUser.uid, 'received');
            const receivedSnapshot = await getDocs(receivedRef);
            receivedSnapshot.forEach(doc => {
                userIds.add(doc.id);
            });

            // For each user, we would fetch user details here
            // For now, return basic structure
            userIds.forEach(userId => {
                conversations.push({
                    userId,
                    userName: `User ${userId.substring(0, 8)}...`,
                    lastMessage: 'Loading...',
                    unreadCount: 0
                });
            });

            return conversations;
        } catch (error) {
            console.error('Error getting conversations:', error);
            return [];
        }
    }

    /**
     * Mark messages as read
     */
    async markAsRead(otherUserId: string): Promise<void> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) return;

        try {
            const receivedRef = collection(
                this.firestore,
                'notifications',
                currentUser.uid,
                'received',
                otherUserId,
                'messages'
            );

            const q = query(receivedRef, where('read', '==', false));
            const snapshot = await getDocs(q);

            if (snapshot.empty) return;

            const batch = writeBatch(this.firestore);
            snapshot.docs.forEach(docSnapshot => {
                batch.update(docSnapshot.ref, { read: true });
            });

            await batch.commit();
            console.log(`Marked ${snapshot.size} messages as read`);
        } catch (error) {
            console.error('Error marking messages as read:', error);
        }
    }

    /**
     * Get invoices (proforma and receipts) for a specific user
     * Fetches from: invoices/{userId}/proforma AND invoices/{userId}/receipt
     */
    getProformaInvoices(userId: string): Observable<any[]> {
        const proformaRef = collection(this.firestore, 'invoices', userId, 'proforma');
        const receiptRef = collection(this.firestore, 'invoices', userId, 'receipt');

        // Query both subcollections
        const qP = query(proformaRef, orderBy('createdAt', 'desc'));
        const qR = query(receiptRef, orderBy('createdAt', 'desc'));

        const proforma$ = collectionData(qP, { idField: 'id' });
        const receipt$ = collectionData(qR, { idField: 'id' });

        // Combine streams
        return combineLatest([proforma$, receipt$]).pipe(
            map(([proformas, receipts]) => {
                const p = proformas.map(i => ({ ...i, invoiceType: i['invoiceType'] || 'proforma' }));
                const r = receipts.map(i => ({ ...i, invoiceType: i['invoiceType'] || 'receipt' }));
                return [...p, ...r].sort((a, b) => {
                    const tA = a['createdAt']?.seconds || 0;
                    const tB = b['createdAt']?.seconds || 0;
                    return tB - tA;
                });
            })
        );
    }

    /**
     * Get all unread messages for the current user (raw list).
     * Used to calculate unread counts per sender.
     */
    getUnreadMessages(userId: string): Observable<Message[]> {
        // Return the centralized subject (userId arg is handled by startUnreadListener on auth change)
        return this.unreadMessages$;
    }

    /**
     * Gets the total count of unread messages for the current user.
     * This uses a collection group query. You may need to create a Firestore index for this.
     * The index should be on the 'messages' collection, with fields 'recipientId' (ascending) and 'read' (ascending).
     */
    getUnreadCount(): Observable<number> {
        return this.unreadMessages$.pipe(map(msgs => msgs.length));
    }

    /**
     * Get a map of unread message counts by senderId.
     */
    getUnreadCountMap(): Observable<{ [senderId: string]: number }> {
        return this.unreadMessages$.pipe(map(msgs => {
            const counts: { [senderId: string]: number } = {};
            msgs.forEach(m => {
                counts[m.senderId] = (counts[m.senderId] || 0) + 1;
            });
            return counts;
        }));
    }
}

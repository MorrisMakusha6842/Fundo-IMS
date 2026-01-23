import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, setDoc, updateDoc, query, collectionData, serverTimestamp, orderBy, where, getDocs, collectionGroup, writeBatch, onSnapshot } from '@angular/fire/firestore';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
import { Observable, combineLatest, map, of, Subscription } from 'rxjs';
import { InvoiceService, Invoice } from './invoice.service';

export interface Message {
    text: string;
    timestamp: any;
    read: boolean;
    senderId: string;
    recipientId: string;
    type?: 'text' | 'invoice';
    invoiceData?: Invoice;
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
    private invoiceSubscription?: Subscription;

    constructor(
        private firestore: Firestore,
        private auth: Auth
    ) {
        // Initialize realtime listener when user logs in
        onAuthStateChanged(this.auth, (user) => {
            if (user) {
                this.startInvoiceListener(user.uid);
            } else {
                this.stopInvoiceListener();
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

    /**
     * Realtime listener for proforma invoices.
     * Automatically creates notifications when new invoices appear.
     */
    private startInvoiceListener(userId: string) {
        this.stopInvoiceListener(); // Ensure no duplicate subscriptions

        this.invoiceSubscription = this.invoiceService.getUserInvoices(userId, 'proforma').subscribe(async invoices => {
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

                    const message: Message = {
                        text: `New Proforma Invoice: ${inv.assetName}`,
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
     * Get proforma invoices for a specific user
     * Fetches from: invoices/{userId}/proforma
     */
    getProformaInvoices(userId: string): Observable<any[]> {
        const invoicesRef = collection(
            this.firestore,
            'invoices',
            userId,
            'proforma'
        );
        const q = query(invoicesRef, orderBy('createdAt', 'desc'));
        return collectionData(q, { idField: 'id' });
    }

    /**
     * Get all unread messages for the current user (raw list).
     * Used to calculate unread counts per sender.
     */
    getUnreadMessages(userId: string): Observable<Message[]> {
        const messagesGroupRef = collectionGroup(this.firestore, 'messages');
        const q = query(messagesGroupRef,
            where('recipientId', '==', userId),
            where('read', '==', false)
        );

        return new Observable<Message[]>(observer => {
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const messages: Message[] = [];
                snapshot.forEach(doc => {
                    // Filter to ensure we only count messages in the 'received' subcollection
                    if (doc.ref.path.includes('/received/')) {
                        messages.push(doc.data() as Message);
                    }
                });
                observer.next(messages);
            }, error => observer.error(error));
            return () => unsubscribe();
        });
    }

    /**
     * Gets the total count of unread messages for the current user.
     * This uses a collection group query. You may need to create a Firestore index for this.
     * The index should be on the 'messages' collection, with fields 'recipientId' (ascending) and 'read' (ascending).
     */
    getUnreadCount(): Observable<number> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            return of(0);
        }

        const messagesGroupRef = collectionGroup(this.firestore, 'messages');
        const q = query(messagesGroupRef,
            where('recipientId', '==', currentUser.uid),
            where('read', '==', false)
        );

        return new Observable<number>(observer => {
            const unsubscribe = onSnapshot(q, (snapshot) => {
                let count = 0;
                snapshot.forEach(doc => {
                    // Filter to ensure we only count messages in the 'received' subcollection
                    if (doc.ref.path.includes('/received/')) {
                        count++;
                    }
                });
                observer.next(count);
            }, error => observer.error(error));
            return () => unsubscribe();
        });
    }
}

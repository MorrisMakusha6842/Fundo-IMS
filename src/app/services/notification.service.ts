import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, setDoc, updateDoc, query, collectionData, serverTimestamp, orderBy, where, getDocs, collectionGroup } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, combineLatest, map, of } from 'rxjs';
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

    constructor(
        private firestore: Firestore,
        private auth: Auth
    ) { }

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
     * Get conversation with a specific user (merge sent and received messages)
     */
    getConversation(otherUserId: string): Observable<Message[]> {
        const currentUser = this.auth.currentUser;
        if (!currentUser) {
            return new Observable(observer => observer.next([]));
        }

        // Handle System Notifications (Invoices)
        if (otherUserId === 'system') {
            return this.invoiceService.getUserInvoices(currentUser.uid, 'proforma').pipe(
                map(invoices => {
                    return invoices.map(inv => {
                        // Handle Firestore Timestamp or Date string
                        let ts = inv.createdAt;
                        if (ts && typeof ts.toDate === 'function') {
                            ts = ts.toDate().toISOString();
                        } else if (!ts) {
                            ts = new Date().toISOString();
                        }

                        return {
                            text: `New Proforma Invoice: ${inv.assetName}`,
                            timestamp: ts,
                            read: true, // System messages are auto-read
                            senderId: 'system',
                            recipientId: currentUser.uid,
                            type: 'invoice',
                            invoiceData: inv
                        } as Message;
                    });
                })
            );
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
        if (otherUserId === 'system') return; // Skip for system user

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

            const updatePromises = snapshot.docs.map(docSnapshot => {
                const docRef = doc(
                    this.firestore,
                    'notifications',
                    currentUser.uid,
                    'received',
                    otherUserId,
                    'messages',
                    docSnapshot.id
                );
                return updateDoc(docRef, { read: true });
            });

            await Promise.all(updatePromises);
            console.log('Messages marked as read');
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

        return collectionData(q).pipe(map(messages => messages.length));
    }
}

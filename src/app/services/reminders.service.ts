import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, where, collectionData, serverTimestamp, orderBy } from '@angular/fire/firestore';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface Reminder {
    id?: string;
    title: string;
    description?: string;
    dueDate: any; // Firestore Timestamp
    type: 'asset_expiry' | 'custom';
    relatedAssetId?: string;
    userId: string;
    status: 'pending' | 'completed';
    createdAt: any;
}

@Injectable({
    providedIn: 'root'
})
export class RemindersService {
    private firestore: Firestore = inject(Firestore);
    private authService: AuthService = inject(AuthService);

    getReminders(): Observable<Reminder[]> {
        return this.authService.user$.pipe(
            switchMap(user => {
                if (!user) {
                    return of([]);
                }
                const remindersRef = collection(this.firestore, `reminders`);
                const q = query(
                    remindersRef,
                    where('userId', '==', user.uid),
                    orderBy('dueDate', 'asc')
                );
                return collectionData(q, { idField: 'id' }) as Observable<Reminder[]>;
            })
        );
    }

    async createReminder(reminderData: Partial<Reminder>): Promise<void> {
        const user = this.authService.currentUser;
        if (!user) {
            throw new Error('User must be logged in to create a reminder.');
        }

        const newReminder = {
            ...reminderData,
            userId: user.uid,
            status: 'pending',
            createdAt: serverTimestamp()
        };

        const remindersRef = collection(this.firestore, 'reminders');
        await addDoc(remindersRef, newReminder);
    }
}
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, where, collectionData, serverTimestamp, orderBy } from '@angular/fire/firestore';
import { Observable, of, combineLatest } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { AssetsService } from './assets.service';

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
    private assetsService: AssetsService = inject(AssetsService);

    getReminders(): Observable<Reminder[]> {
        return this.authService.user$.pipe(
            switchMap(user => {
                if (!user) {
                    return of([]);
                }

                // 1. Fetch Manual Reminders
                const remindersRef = collection(this.firestore, `reminders`);
                const q = query(
                    remindersRef,
                    where('userId', '==', user.uid)
                );
                const manualReminders$ = collectionData(q, { idField: 'id' }) as Observable<Reminder[]>;

                // 2. Fetch Assets for Auto-Reminders
                const assets$ = this.assetsService.getUserVehicles(user.uid);

                return combineLatest([manualReminders$, assets$]).pipe(
                    map(([manual, assets]) => {
                        const assetReminders: Reminder[] = [];
                        const now = new Date();

                        assets.forEach(asset => {
                            if (asset.policyExpiryDate) {
                                const expiry = new Date(asset.policyExpiryDate);
                                assetReminders.push({
                                    id: `expiry-${asset.id}`,
                                    title: `Policy Expiry: ${asset.make} ${asset.numberPlate}`,
                                    description: 'Insurance policy is expiring',
                                    dueDate: this.createTimestamp(expiry),
                                    type: 'asset_expiry',
                                    relatedAssetId: asset.id,
                                    userId: user.uid,
                                    status: expiry < now ? 'pending' : 'pending', // Mark as pending so it shows up
                                    createdAt: asset.createdAt
                                });
                            }
                        });

                        // Merge and Sort by Due Date
                        const combined = [...manual, ...assetReminders];
                        return combined.sort((a, b) => {
                            const dateA = this.getDateFromTimestamp(a.dueDate);
                            const dateB = this.getDateFromTimestamp(b.dueDate);
                            return dateA.getTime() - dateB.getTime();
                        });
                    })
                );
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

    // Helper to mock Firestore Timestamp for consistency in UI
    private createTimestamp(date: Date) {
        return {
            toDate: () => date,
            seconds: Math.floor(date.getTime() / 1000),
            nanoseconds: 0
        };
    }

    private getDateFromTimestamp(ts: any): Date {
        if (ts && typeof ts.toDate === 'function') return ts.toDate();
        return new Date(ts);
    }
}
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, collectionData, query, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface BillingAccount {
    id?: string;
    uid: string;
    accountName: string;
    provider: 'Ecocash';
    phoneNumber: string;
    status: 'Active' | 'Inactive';
    createdAt: any;
    expDate?: string;
    accountPassword?: string;
}

@Injectable({
    providedIn: 'root'
})
export class BillingInformationService {
    private firestore = inject(Firestore);
    private collectionName = 'billing_information';

    getAllAccounts(): Observable<BillingAccount[]> {
        const colRef = collection(this.firestore, this.collectionName);
        return collectionData(colRef, { idField: 'id' }) as Observable<BillingAccount[]>;
    }

    getUserAccounts(uid: string): Observable<BillingAccount[]> {
        const colRef = collection(this.firestore, this.collectionName);
        const q = query(colRef, where('uid', '==', uid));
        return collectionData(q, { idField: 'id' }) as Observable<BillingAccount[]>;
    }

    async addAccount(account: BillingAccount): Promise<void> {
        const colRef = collection(this.firestore, this.collectionName);
        await addDoc(colRef, account);
    }

    async updateAccount(account: Partial<BillingAccount> & { id: string }): Promise<void> {
        const docRef = doc(this.firestore, this.collectionName, account.id);
        const { id, ...data } = account;
        await updateDoc(docRef, data);
    }

    async deleteAccount(id: string): Promise<void> {
        const docRef = doc(this.firestore, this.collectionName, id);
        await deleteDoc(docRef);
    }

    isAccountValid(account: BillingAccount): boolean {
        if (account.status !== 'Active') {
            return false;
        }

        if (account.expDate) {
            const now = new Date();
            const expiry = new Date(account.expDate);
            if (!isNaN(expiry.getTime()) && expiry < now) {
                return false;
            }
        }
        return true;
    }
}
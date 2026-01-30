import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, updateDoc, deleteDoc, doc, collectionData, query, serverTimestamp } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface PaymentAccount {
    id?: string;
    name: string;
    provider: 'Ecocash' | 'OneMoney' | 'Bank';
    accountNumber: string;
    paynowId: string;
    paynowKey: string;
    status: 'Active' | 'Inactive';
}

@Injectable({
    providedIn: 'root'
})
export class AccountReceivableService {
    private firestore = inject(Firestore);
    private collectionName = 'account_receivables';

    getAccounts(): Observable<PaymentAccount[]> {
        const colRef = collection(this.firestore, this.collectionName);
        const q = query(colRef);
        return collectionData(q, { idField: 'id' }) as Observable<PaymentAccount[]>;
    }

    async addAccount(account: PaymentAccount): Promise<void> {
        const colRef = collection(this.firestore, this.collectionName);
        await addDoc(colRef, account);
    }

    async updateAccount(account: PaymentAccount): Promise<void> {
        if (!account.id) return;
        const docRef = doc(this.firestore, this.collectionName, account.id);
        const { id, ...data } = account;
        await updateDoc(docRef, data);
    }

    async deleteAccount(id: string): Promise<void> {
        const docRef = doc(this.firestore, this.collectionName, id);
        await deleteDoc(docRef);
    }

    /**
     * Records a transaction into the 'payment-history' sub-collection of a specific account.
     * This structure allows for scalable history per account without hitting document size limits.
     * @param accountId The ID of the receiving account (e.g. Main Bank ID)
     * @param transaction The transaction details
     */
    async recordTransaction(accountId: string, transaction: any): Promise<string> {
        // Structure: account_receivables/{accountId}/payment-history/{transactionId}
        const colRef = collection(this.firestore, this.collectionName, accountId, 'payment-history');
        const txWithTimestamp = { ...transaction, createdAt: serverTimestamp() };
        const docRef = await addDoc(colRef, txWithTimestamp);
        return docRef.id;
    }
}
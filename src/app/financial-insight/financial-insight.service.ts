import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, query, orderBy, limit, getDocs, collectionData, Timestamp } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

export interface FinancialRecord {
    id?: string;
    dateApplied: any; // Timestamp or Date
    appliedBy: {
        uid: string;
        displayName: string;
    };
    previousTaxRate: number;
    currentTaxRate: number;
    previousFxRate: number;
    currentFxRate: number;
    taxRateId: string;
}

@Injectable({
    providedIn: 'root'
})
export class FinancialInsightService {
    private firestore = inject(Firestore);
    private collectionName = 'financial_insights';

    getHistory(): Observable<FinancialRecord[]> {
        const colRef = collection(this.firestore, this.collectionName);
        const q = query(colRef, orderBy('dateApplied', 'desc'));
        return collectionData(q, { idField: 'id' }) as Observable<FinancialRecord[]>;
    }

    async getLatestRecord(): Promise<FinancialRecord | null> {
        const colRef = collection(this.firestore, this.collectionName);
        const q = query(colRef, orderBy('dateApplied', 'desc'), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as FinancialRecord;
    }

    async addRecord(record: FinancialRecord): Promise<void> {
        const colRef = collection(this.firestore, this.collectionName);
        await addDoc(colRef, record);
    }
}
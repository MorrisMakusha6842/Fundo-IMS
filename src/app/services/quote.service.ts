import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';

export interface Quote {
    policyId: string;
    policyName: string;
    assetId: string;
    assetName: string;
    premium: number;
    frequency: 'monthly' | 'annually';
    userId: string;
    status: 'draft' | 'pending_payment' | 'active';
    createdAt: any;
}

@Injectable({
    providedIn: 'root'
})
export class QuoteService {
    private firestore = inject(Firestore);

    async createQuote(quote: Quote) {
        const colRef = collection(this.firestore, 'quotes');
        // Ensure createdAt is set if not passed, though usually passed from component or here
        return addDoc(colRef, { ...quote, createdAt: quote.createdAt || serverTimestamp() });
    }
}
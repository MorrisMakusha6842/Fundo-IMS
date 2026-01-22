import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';

export interface Invoice {
    id?: string;
    assetId: string;
    assetName: string;
    clientId: string;
    clientName: string; // Captured at time of invoice creation for simplicity
    amount: number;
    status: 'Pending' | 'Paid';
    createdAt: any;
    generatedBy: string; // Admin UID
    description?: string;
}

@Injectable({
    providedIn: 'root'
})
export class InvoiceService {

    constructor(private firestore: Firestore) { }

    async createInvoice(invoice: Invoice): Promise<string> {
        try {
            const invoicesCollection = collection(this.firestore, 'invoices');
            const docRef = await addDoc(invoicesCollection, invoice);
            console.log("Invoice created with ID: ", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("Error creating invoice: ", e);
            throw e;
        }
    }
}

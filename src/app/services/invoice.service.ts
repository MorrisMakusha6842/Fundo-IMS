import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, orderBy, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Invoice {
    id?: string;
    assetId: string;
    assetName: string;
    clientId: string;
    clientName: string;
    amount: number;
    status: 'Pending' | 'Paid';
    createdAt: any;
    generatedBy: string; // Admin UID
    description?: string;
    invoiceType?: 'proforma' | 'tax' | 'receipt';
}

@Injectable({
    providedIn: 'root'
})
export class InvoiceService {

    constructor(private firestore: Firestore) { }

    async createInvoice(invoice: Invoice): Promise<string> {
        try {
            const type = invoice.invoiceType || 'proforma';
            // Structure: invoices/{clientId}/{type}/{invoiceId}
            const invoicesRef = collection(this.firestore, 'invoices', invoice.clientId, type);
            const docRef = await addDoc(invoicesRef, invoice);
            console.log("Invoice created with ID: ", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("Error creating invoice: ", e);
            throw e;
        }
    }

    /**
     * Get invoices for a specific user
     * Fetches from: invoices/{userId}/{type}
     */
    getUserInvoices(userId: string, type: string = 'proforma'): Observable<Invoice[]> {
        const invoicesRef = collection(this.firestore, 'invoices', userId, type);
        const q = query(invoicesRef, orderBy('createdAt', 'desc'));
        return collectionData(q, { idField: 'id' }) as Observable<Invoice[]>;
    }
}

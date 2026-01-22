import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';

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
}

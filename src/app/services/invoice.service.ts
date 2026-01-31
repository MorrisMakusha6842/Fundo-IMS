import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, orderBy, collectionData, where } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Invoice {
    id?: string;
    assetId: string;
    assetName: string;
    clientId: string;
    clientName: string;
    amount: number;
    status: 'Pending' | 'Paid' | 'Unpaid';
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
            // Store in a root collection for easier querying. We include clientId in the doc data.
            const invoicesRef = collection(this.firestore, 'invoices');
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
     */
    getUserInvoices(userId: string): Observable<Invoice[]> {
        const invoicesRef = collection(this.firestore, 'invoices');
        const q = query(invoicesRef, where('clientId', '==', userId), orderBy('createdAt', 'desc'));
        return collectionData(q, { idField: 'id' }) as Observable<Invoice[]>;
    }

    /**
     * Get all invoices (for Admin/Agent)
     */
    getAllInvoices(): Observable<Invoice[]> {
        const invoicesRef = collection(this.firestore, 'invoices');
        const q = query(invoicesRef, orderBy('createdAt', 'desc'));
        return collectionData(q, { idField: 'id' }) as Observable<Invoice[]>;
    }
}

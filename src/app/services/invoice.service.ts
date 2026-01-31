import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, query, orderBy, collectionData, where, collectionGroup } from '@angular/fire/firestore';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';

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
     * Fetches from: invoices/{userId}/proforma AND invoices/{userId}/receipt
     */
    getUserInvoices(userId: string): Observable<Invoice[]> {
        const proformaRef = collection(this.firestore, 'invoices', userId, 'proforma');
        const receiptRef = collection(this.firestore, 'invoices', userId, 'receipt');

        const qP = query(proformaRef, orderBy('createdAt', 'desc'));
        const qR = query(receiptRef, orderBy('createdAt', 'desc'));

        const proforma$ = collectionData(qP, { idField: 'id' }) as Observable<Invoice[]>;
        const receipt$ = collectionData(qR, { idField: 'id' }) as Observable<Invoice[]>;

        return combineLatest([proforma$, receipt$]).pipe(
            map(([proformas, receipts]) => {
                const combined = [...proformas, ...receipts];
                // Re-sort combined list by date descending
                return combined.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            })
        );
    }

    /**
     * Get all invoices (for Admin/Agent)
     * Uses collectionGroup to fetch all proforma and receipt documents across all users
     */
    getAllInvoices(): Observable<Invoice[]> {
        const qP = query(collectionGroup(this.firestore, 'proforma'), orderBy('createdAt', 'desc'));
        const qR = query(collectionGroup(this.firestore, 'receipt'), orderBy('createdAt', 'desc'));

        const proforma$ = collectionData(qP, { idField: 'id' }) as Observable<Invoice[]>;
        const receipt$ = collectionData(qR, { idField: 'id' }) as Observable<Invoice[]>;

        return combineLatest([proforma$, receipt$]).pipe(
            map(([proformas, receipts]) => {
                const combined = [...proformas, ...receipts];
                return combined.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            })
        );
    }
}

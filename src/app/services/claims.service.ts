import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp } from '@angular/fire/firestore';

export interface ClaimData {
    userId: string;
  displayName: string;
  claimId: string;
    assetId: string;
    assetDescription: string;
    policyId: string;
    policyName: string;
  policy: any;
    claimType: string;
    description: string;
    status: 'Pending' | 'Approved' | 'Rejected' | 'In Review';
    createdAt: any;
    updatedAt: any;
}

@Injectable({
    providedIn: 'root'
})
export class ClaimsService {
    private firestore = inject(Firestore);

    async createClaim(claim: Partial<ClaimData>) {
        try {
            const claimsRef = collection(this.firestore, 'claims');
            const docRef = await addDoc(claimsRef, {
                ...claim,
                status: 'Pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating claim:', error);
            throw error;
        }
    }
}
import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, collectionData, doc, query, where, collectionGroup, deleteDoc, updateDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface PolicyCoverage {
    name: string;
    percentage?: number;
    amount?: number;
}

export interface PolicyPackage {
    name: string;
    coverages: PolicyCoverage[];
}

export interface PolicyData {
    policyName: string;
    policyType?: 'standard' | 'renewal';
    tenure: string;
    packages: PolicyPackage[];
    [key: string]: any; // Allow other props like timestamps/status
}

@Injectable({
    providedIn: 'root'
})
export class PolicyService {
    private firestore = inject(Firestore);

    /**
     * Fetches all Sub Categories (which act as the main categories).
     * Collection: sub-categories
     */
    getSubCategories(): Observable<any[]> {
        const colRef = collection(this.firestore, 'sub-categories');
        return collectionData(colRef, { idField: 'id' });
    }

    /**
     * Adds a new Sub Category.
     */
    async addSubCategory(data: any) {
        const colRef = collection(this.firestore, 'sub-categories');
        return addDoc(colRef, data);
    }

    /**
     * Adds a policy to a specific sub-category.
     * Path: sub-categories/{subCategoryId}/policies/{autoId}
     */
    async addPolicy(subCategoryId: string, policyData: PolicyData) {
        const colRef = collection(this.firestore, `sub-categories/${subCategoryId}/policies`);
        return addDoc(colRef, policyData);
    }

    /**
     * Fetches all policies across all sub-categories using a Collection Group Query.
     */
    getAllPolicies(): Observable<any[]> {
        const q = query(collectionGroup(this.firestore, 'policies'));
        return collectionData(q, { idField: 'id' });
    }

    /**
     * Deletes a sub-category.
     */
    async deleteSubCategory(id: string) {
        const docRef = doc(this.firestore, 'sub-categories', id);
        return deleteDoc(docRef);
    }

    /**
     * Deletes a policy from a sub-category.
     */
    async deletePolicy(subCategoryId: string, policyId: string) {
        const docRef = doc(this.firestore, `sub-categories/${subCategoryId}/policies`, policyId);
        return deleteDoc(docRef);
    }

    /**
     * Updates a policy document.
     */
    async updatePolicy(subCategoryId: string, policyId: string, data: any) {
        const docRef = doc(this.firestore, `sub-categories/${subCategoryId}/policies`, policyId);
        return updateDoc(docRef, data);
    }

    /**
     * Fetches policies for a specific sub-category.
     */
    getPoliciesBySubCategory(subCategoryId: string): Observable<any[]> {
        const colRef = collection(this.firestore, `sub-categories/${subCategoryId}/policies`);
        return collectionData(colRef, { idField: 'id' });
    }

    /**
     * Fetches packages for a specific policy.
     */
    getPolicyPackages(policyId: string): Observable<any[]> {
        const q = query(collectionGroup(this.firestore, 'packages'), where('policyId', '==', policyId));
        return collectionData(q, { idField: 'id' });
    }
}
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, collectionGroup, query, deleteDoc, collectionData } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface VehicleAsset {
    garagingAddress: string;
    make: string;
    numberPlate: string;
    primaryUse: string;
    uid: string;
    userId: string;
    vehicleClass: string;
    vin: string;
    year: number;
    bodyType: string;
    createdAt: any; // Timestamp
    updatedAt?: any; // Timestamp
    assetValue: string;
    safetyFeatures?: string;
    policyDeploymentDate?: string;
    policyExpiryDate?: string;
    documents?: {
        name: string;
        type: string;
        storageData?: any;
        dataUrl?: string;
        field: string;
        uploadedAt: string;
        expiryDate?: string;
    }[]; 
    status: 'Pending' | 'Approved' | 'Rejected';
    id?: string; // Add optional ID
}

@Injectable({
    providedIn: 'root'
})
export class AssetsService {

    constructor(private firestore: Firestore) { }

    async addVehicleAsset(vehicle: VehicleAsset): Promise<string> {
        try {
            const assetsCollection = collection(this.firestore, 'assets');
            const vehicleCollection = collection(assetsCollection, vehicle.uid, 'vehicles'); // Subcollection under asset document
            const docRef = await addDoc(vehicleCollection, vehicle);
            console.log("Document written with ID: ", docRef.id);
            return docRef.id;
        } catch (e) {
            console.error("Error adding document: ", e);
            throw e;
        }
    }

    async updateVehicleAsset(vehicleId: string, vehicle: VehicleAsset): Promise<void> {
        try {
            // Assuming you have the asset's UID to build the correct path
            const assetDocRef = doc(this.firestore, 'assets', vehicle.uid, 'vehicles', vehicleId);
            await updateDoc(assetDocRef, { ...vehicle });
            console.log("Document updated with ID: ", vehicleId);
        } catch (e) {
            console.error("Error updating document: ", e);
            throw e;
        }
    }

    getAllVehicles(): Observable<VehicleAsset[]> {
        // Use collectionGroup to query all 'vehicles' subcollections across all assets
        const vehiclesQuery = query(collectionGroup(this.firestore, 'vehicles'));
        // Returns an observable that emits whenever the data changes
        return collectionData(vehiclesQuery, { idField: 'id' }) as Observable<VehicleAsset[]>;
    }

    getUserVehicles(userId: string): Observable<VehicleAsset[]> {
        // Query the specific 'vehicles' subcollection for a single user
        const vehiclesCollection = collection(this.firestore, 'assets', userId, 'vehicles');
        return collectionData(vehiclesCollection, { idField: 'id' }) as Observable<VehicleAsset[]>;
    }

    async deleteVehicle(uid: string, vehicleId: string): Promise<void> {
        try {
            const docRef = doc(this.firestore, 'assets', uid, 'vehicles', vehicleId);
            await deleteDoc(docRef);
        } catch (e) {
            console.error("Error deleting vehicle: ", e);
            throw e;
        }
    }

    async approveAsset(uid: string, vehicleId: string, assuredValue: number, approvedBy: string): Promise<void> {
        try {
            const docRef = doc(this.firestore, 'assets', uid, 'vehicles', vehicleId);
            await updateDoc(docRef, {
                status: 'Active',
                assetValue: assuredValue.toString(),
                approvedBy: approvedBy,
                approvedAt: new Date().toISOString()
            });
            console.log("Asset approved with ID: ", vehicleId);
        } catch (e) {
            console.error("Error approving asset: ", e);
            throw e;
        }
    }
}
import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, doc, updateDoc, collectionGroup, getDocs, query, deleteDoc } from '@angular/fire/firestore';

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
    assetValue: string;
    safetyFeatures?: string;
    policyDeploymentDate?: string;
    policyExpiryDate?: string;
    documents?: any[]; // Array to hold file data (name, type, dataUrl)
    status: 'Pending' | 'Approved' | 'Rejected';
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

    async getAllVehicles(): Promise<VehicleAsset[]> {
        try {
            // Use collectionGroup to query all 'vehicles' subcollections across all assets
            const vehiclesQuery = query(collectionGroup(this.firestore, 'vehicles'));
            const querySnapshot = await getDocs(vehiclesQuery);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as VehicleAsset));
        } catch (e) {
            console.error("Error fetching vehicles: ", e);
            return [];
        }
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
}
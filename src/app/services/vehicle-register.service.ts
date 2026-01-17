import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp, Firestore, getDoc, DocumentData, collection, query, where, getDocs } from 'firebase/firestore';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VehicleRegisterService {
  private db: Firestore;

  constructor() {
    if (!getApps().length) initializeApp(environment.firebase);
    this.db = getFirestore();
  }

  /** Get all vehicle-register docs for a given user id */
  async getByUserId(uid: string): Promise<DocumentData[]> {
    try {
      const vRef = collection(this.db, 'vehicle-register');
      const q = query(vRef, where('userId', '==', uid));
      const snap = await getDocs(q);
      return snap.docs.map(doc => doc.data());
    } catch (err) {
      console.warn('VehicleRegisterService.getByUserId failed', err);
      return [];
    }
  }

  /** Create or update vehicle-register doc for the user (doc id = uid) */
  async createOrUpdate(uid: string, data: Record<string, any>) {
    try {
      const vRef = doc(this.db, 'vehicle-register', uid);
      await setDoc(vRef, { uid, userId: uid, ...data, createdAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.warn('VehicleRegisterService.createOrUpdate failed', err);
      throw err;
    }
  }
}

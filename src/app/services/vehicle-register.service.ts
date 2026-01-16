import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp, Firestore, getDoc, DocumentData } from 'firebase/firestore';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class VehicleRegisterService {
  private db: Firestore;

  constructor() {
    if (!getApps().length) initializeApp(environment.firebase);
    this.db = getFirestore();
  }

  /** Get the vehicle-register doc for a given user id (doc id = uid) */
  async getByUserId(uid: string): Promise<DocumentData | null> {
    try {
      const vRef = doc(this.db, 'vehicle-register', uid);
      const snap = await getDoc(vRef);
      if (snap.exists()) return snap.data();
      return null;
    } catch (err) {
      console.warn('VehicleRegisterService.getByUserId failed', err);
      return null;
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


import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, Auth } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

export interface ProfileData {
	company?: string;
	numberPlate?: string;
	location?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
	private auth: Auth;
	private db: Firestore;

	constructor() {
		// Initialize Firebase app if not already initialized
		if (!getApps().length) {
			initializeApp(environment.firebase);
		}
		this.auth = getAuth();
		this.db = getFirestore();
	}

	/**
	 * Create a new user with email and password. Optionally sets displayName, sends verification email,
	 * and persists profile data to Firestore under `users/{uid}`.
	 */
	async createUser(email: string, password: string, displayName?: string, profile?: ProfileData) {
		try {
			const userCred = await createUserWithEmailAndPassword(this.auth, email, password);
			if (displayName) {
				await updateProfile(userCred.user, { displayName });
			}
			// try to send verification email
			try { await sendEmailVerification(userCred.user); } catch (e) { /* ignore */ }

			// Persist profile data to Firestore (best-effort)
			try {
				const userRef = doc(this.db, 'users', userCred.user.uid);
				await setDoc(userRef, {
					uid: userCred.user.uid,
					email: userCred.user.email,
					displayName: userCred.user.displayName || displayName || null,
					company: profile?.company || null,
					numberPlate: profile?.numberPlate || null,
					location: profile?.location || null,
					createdAt: serverTimestamp()
				});
			} catch (fireErr) {
				// Firestore write failed; surface a warning but don't block account creation
				console.warn('Failed to persist profile to Firestore', fireErr);
			}

			return userCred;
		} catch (err: any) {
			let message = 'An error occurred while creating the account.';
			if (err?.code) {
				switch (err.code) {
					case 'auth/email-already-in-use':
						message = 'This email is already in use.';
						break;
					case 'auth/invalid-email':
						message = 'Invalid email address.';
						break;
					case 'auth/weak-password':
						message = 'Password is too weak (min 6 characters).';
						break;
					default:
						message = err.message || message;
				}
			} else if (err?.message) {
				message = err.message;
			}
			throw new Error(message);
		}
	}

}

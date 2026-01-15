
import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, Auth } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp, Firestore, updateDoc } from 'firebase/firestore';
// We do not use Firebase Storage in this build; images will be stored as data URLs in Firestore.
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

		/**
		 * Save a profile image as a data URL in the user's Firestore document and return that data URL.
		 * Note: storing large images in Firestore is not ideal for production; this follows the repo request
		 * to avoid Firebase Storage for now. Consider switching to Storage for production.
		 */
		async uploadProfileImage(uid: string, file: File): Promise<string> {
			try {
				const dataUrl = await this.fileToDataUrl(file);
				// store it on the user doc under `avatarDataUrl`
				const userRef = doc(this.db, 'users', uid);
				await setDoc(userRef, { avatarDataUrl: dataUrl }, { merge: true });
				return dataUrl;
			} catch (err) {
				console.warn('uploadProfileImage failed (firestore)', err);
				throw err;
			}
		}

		private fileToDataUrl(file: File): Promise<string> {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = (e) => reject(e);
				reader.readAsDataURL(file);
			});
		}

		/** Update the user's Firestore profile document with additional fields (merge) */
		async updateUserProfile(uid: string, data: Record<string, any>) {
			try {
				const userRef = doc(this.db, 'users', uid);
				await updateDoc(userRef, data);
			} catch (err) {
				// if doc doesn't exist, set it
				try {
					const userRef = doc(this.db, 'users', uid);
					await setDoc(userRef, { uid, ...data }, { merge: true });
				} catch (e) {
					console.warn('updateUserProfile failed', e);
				}
			}
		}

}

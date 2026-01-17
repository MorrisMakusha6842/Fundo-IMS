import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, Auth, signOut } from 'firebase/auth';
import {
	getFirestore,
	doc,
	setDoc,
	serverTimestamp,
	Firestore,
	updateDoc,
	deleteDoc,
	getDoc,
	DocumentData
} from 'firebase/firestore';
// We intentionally store small images/docs as data URLs in Firestore for this project.
import { environment } from '../../environments/environment';

export interface ProfileData {
	company?: string;
	numberPlate?: string;
	location?: string;
	role?: string;
	usa?: {
		usaStatus: string;
		agreedAt: number;
	};
}

@Injectable({ providedIn: 'root' })
export class UserService {
	private auth: Auth;
	private db: Firestore;

	constructor() {
		if (!getApps().length) {
			initializeApp(environment.firebase);
		}
		this.auth = getAuth();
		this.db = getFirestore();
	}

	/** Read users/{uid} or null */
	async getUserProfile(uid: string): Promise<DocumentData | null> {
		try {
			const userRef = doc(this.db, 'users', uid);
			const snap = await getDoc(userRef);
			if (snap.exists()) return snap.data();
			return null;
		} catch (err) {
			console.warn('getUserProfile failed', err);
			return null;
		}
	}

	/** Create an auth user, send verification, and write a basic users/{uid} doc. */
	async createUser(email: string, password: string, displayName?: string, profile?: ProfileData) {
		// Use a secondary app instance if a user is already logged in (e.g. Admin creating a client)
		// to prevent the current session from being replaced by the new user.
		let authInstance = this.auth;
		let secondaryApp: FirebaseApp | null = null;

		if (this.auth.currentUser) {
			const appName = 'secondaryUserCreationApp';
			try {
				secondaryApp = getApp(appName);
			} catch (e) {
				secondaryApp = initializeApp(environment.firebase, appName);
			}
			authInstance = getAuth(secondaryApp);
		}

		try {
			const userCred = await createUserWithEmailAndPassword(authInstance, email, password);
			if (displayName) {
				try {
					await updateProfile(userCred.user, { displayName });
				} catch (e) {
					// ignore profile update error
				}
			}
			try {
				await sendEmailVerification(userCred.user);
			} catch (e) {
				// ignore
			}

			// Best-effort persist profile to Firestore
			try {
				const userRef = doc(this.db, 'users', userCred.user.uid);
				await setDoc(
					userRef,
					{
						uid: userCred.user.uid,
						email: userCred.user.email,
						displayName: userCred.user.displayName || displayName || null,
						company: profile?.company || null,
						numberPlate: profile?.numberPlate || null,
						location: profile?.location || null,
						role: profile?.role || 'client',
						usa: profile?.usa || null,
						createdAt: serverTimestamp()
					},
					{ merge: true }
				);
			} catch (fireErr) {
				console.warn('Failed to persist profile to Firestore', fireErr);
			}

			// If we used a secondary app, sign out to clean up that temporary session
			if (secondaryApp) {
				await signOut(authInstance);
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

	/** Save a profile image as a data URL in the user's Firestore document and return it. */
	async uploadProfileImage(uid: string, file: File): Promise<string> {
		try {
			const dataUrl = await this.fileToDataUrl(file);
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
			// fallback: set with merge when doc doesn't exist or update fails
			try {
				const userRef = doc(this.db, 'users', uid);
				await setDoc(userRef, { uid, ...data }, { merge: true });
			} catch (e) {
				console.warn('updateUserProfile failed', e);
				throw e;
			}
		}
	}

	/** Delete a user document from Firestore */
	async deleteUser(uid: string) {
		try {
			const userRef = doc(this.db, 'users', uid);
			await deleteDoc(userRef);
		} catch (err) {
			console.warn('deleteUser failed', err);
			throw err;
		}
	}
}

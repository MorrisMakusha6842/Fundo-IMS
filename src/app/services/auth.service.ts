import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, User, Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, fetchSignInMethodsForEmail, linkWithCredential } from 'firebase/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth: Auth;
  private _user = new BehaviorSubject<User | null>(null);

  constructor() {
    if (!getApps().length) {
      initializeApp(environment.firebase);
    }
    this.auth = getAuth();
    // Initialize with currentUser if already available, then listen for changes
    this._user.next(this.auth.currentUser || null);
    onAuthStateChanged(this.auth, (user) => this._user.next(user));
  }

  get user$(): Observable<User | null> {
    return this._user.asObservable();
  }

  get currentUser(): User | null {
    return this._user.value;
  }

  async signOut() {
    return signOut(this.auth);
  }

  async signIn(email: string, password: string) {
    try {
      const cred = await signInWithEmailAndPassword(this.auth, email, password);
      return cred;
    } catch (err: any) {
      let message = 'Failed to sign in.';
      if (err?.code) {
        switch (err.code) {
          case 'auth/user-not-found':
            message = 'No account found for this email.';
            break;
          case 'auth/wrong-password':
            message = 'Incorrect password.';
            break;
          case 'auth/invalid-email':
            message = 'Invalid email address.';
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

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const cred = await signInWithPopup(this.auth, provider);
      return cred;
    } catch (err: any) {
      // If the account already exists with a different credential, surface more info so the UI
      // can perform linking (e.g., sign in with email/password then link the Google credential).
      if (err?.code === 'auth/account-exists-with-different-credential') {
        const email = err?.customData?.email || err?.email || null;
        const pendingCred = err?.credential || null;
        let methods: string[] = [];
        try {
          if (email) methods = await fetchSignInMethodsForEmail(this.auth, email);
        } catch (e) {
          // ignore
        }
        const e = new Error('Account exists with a different credential');
        (e as any).code = err.code;
        (e as any).email = email;
        (e as any).pendingCredential = pendingCred;
        (e as any).methods = methods;
        throw e;
      }
      let message = 'Google sign-in failed.';
      if (err?.message) message = err.message;
      throw new Error(message);
    }
  }

  /**
   * Link a pending Google credential to an existing email/password account.
   * The caller should have obtained a pendingCredential from a previous failed popup attempt
   * (error.credential) and prompt the user to sign in with their password to confirm.
   */
  async linkGoogleCredentialToEmail(pendingCredential: any, email: string, password: string) {
    try {
      // Sign in the existing account
      const emailCred = await signInWithEmailAndPassword(this.auth, email, password);
      // Link the pending Google credential to the signed-in user
      await linkWithCredential(emailCred.user, pendingCredential);
      return true;
    } catch (err: any) {
      let message = 'Failed to link accounts.';
      if (err?.message) message = err.message;
      throw new Error(message);
    }
  }
}

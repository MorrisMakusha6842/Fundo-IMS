import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, User, Auth, signInWithEmailAndPassword } from 'firebase/auth';
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
}

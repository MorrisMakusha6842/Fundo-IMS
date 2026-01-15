import { Injectable } from '@angular/core';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged, signOut, User, Auth } from 'firebase/auth';
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
}

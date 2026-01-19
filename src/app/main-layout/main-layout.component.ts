import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AccountInitialisingComponent } from './account-initialising.component';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { Firestore, collection, query, where, limit, getDocs } from '@angular/fire/firestore';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AccountInitialisingComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent {
  showUserMenu = false;
  notificationsCount = 3; // placeholder counts; replace with real data source
  messagesCount = 1;
  userPhotoUrl: string | null = null;
  userDisplayName: string | null = null;
  sideNavCollapsed = false;
  mobileMenuOpen = false;
  showAccountInit = false;
  isCheckingInit = false;

  private firestore = inject(Firestore);

  constructor(
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private userService: UserService
  ) {
    // subscribe to auth user to show photo and name if available
    this.auth.user$.subscribe(u => {
      this.userPhotoUrl = u?.photoURL || null;
      this.userDisplayName = u?.displayName || u?.email || 'User';
      // check if we should display the account-initialising modal for newly signed in users
      if (u?.uid) {
        this.checkUserInit(u.uid);
      } else {
        this.showAccountInit = false;
        this.isCheckingInit = false;
      }
    });
  }

  private async checkUserInit(uid: string) {
    try {
      const profile = await this.userService.getUserProfile(uid);

      // Only show for clients
      const role = profile?.['role'] || 'client';
      if (role !== 'client') {
        this.isCheckingInit = false;
        this.showAccountInit = false;
        return;
      }
      this.isCheckingInit = true;

      // Determine usa agreement status (stored under a 'usa' object or as a top-level usaStatus)
      const usaAgreed = !!(
        profile && (
          (profile['usa'] && profile['usa']['usaStatus'] === 'agreed') ||
          profile['usaStatus'] === 'agreed'
        )
      );

      // Check for existing vehicle record in 'assets/{uid}/vehicles' collection for this user
      const q = query(collection(this.firestore, 'assets', uid, 'vehicles'), limit(1));
      const snapshot = await getDocs(q);
      const vehicle = !snapshot.empty;

      // Show modal if either agreement not given or vehicle data missing
      this.showAccountInit = !(usaAgreed && !!vehicle);
    } catch (err) {
      console.warn('Failed to check user init', err);
      // be conservative: if we cannot check, don't block access; hide modal
      this.showAccountInit = false;
    } finally {
      this.isCheckingInit = false;
    }
  }

  async onAccountInitClose() {
    // Close modal; the modal itself should have written usa status and vehicle data.
    this.showAccountInit = false;
    // Re-check in case data wasn't written synchronously
    const uid = this.auth.currentUser?.uid;
    if (uid) {
      // schedule a short re-check
      setTimeout(() => void this.checkUserInit(uid), 400);
    }
  }

  navigateTo(path: string) {
    // convenience router wrapper for sidebar links
    // ensure child routes are navigated under /app so MainLayout stays mounted
    if (!path) { return }
    // if a full URL-like path is provided, use navigateByUrl for clarity
    if (path.startsWith('/')) {
      // ensure top-level `/home` becomes `/main-layout/home` unless already /main-layout
      if (path.startsWith('/main-layout')) {
        this.router.navigateByUrl(path);
      } else {
        this.router.navigateByUrl(`/main-layout${path}`);
      }
      return;
    }

    // otherwise treat as a child under /main-layout
    this.router.navigate(['/main-layout', path]);
  }

  toggleSideNav() {
    this.sideNavCollapsed = !this.sideNavCollapsed;
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu() {
    this.mobileMenuOpen = false;
  }

  toggleUserMenu() {
    this.showUserMenu = !this.showUserMenu;
  }

  async signOut() {
    try {
      await this.auth.signOut();
      this.toast.show('Signed out', 'info');
      this.router.navigate(['/']);
    } catch (err: any) {
      this.toast.show(err?.message || 'Failed to sign out', 'error');
    }
  }
}

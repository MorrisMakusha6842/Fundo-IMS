import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AccountInitialisingComponent } from './account-initialising.component';
import { NotificationIconComponent } from '../shared/notification-icon/notification-icon.component';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { Firestore } from '@angular/fire/firestore';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, AccountInitialisingComponent, NotificationIconComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayoutComponent implements OnInit {
  sideNavCollapsed = false;
  mobileMenuOpen = false;
  showUserMenu = false;

  userPhotoUrl: string | null = null;
  userDisplayName: string | null = null;

  // Account init state
  showAccountInit = false;
  isCheckingInit = false;

  // Services
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private userService = inject(UserService);
  private firestore = inject(Firestore);

  // Expose user role for template
  userRole$ = this.auth.userRole$;

  constructor() { }

  ngOnInit() {
    // subscribe to auth user to show photo and name if available
    this.auth.user$.subscribe(u => {
      if (u) {
        this.userPhotoUrl = u.photoURL;
        this.userDisplayName = u.displayName || u.email;
        this.checkUserInit(u.uid);
      } else {
        this.userPhotoUrl = null;
        this.userDisplayName = null;
        this.showAccountInit = false;
        this.isCheckingInit = false;
      }
    });
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

  navigateTo(path: string) {
    this.router.navigate([path]);
    this.showUserMenu = false;
    this.mobileMenuOpen = false;
  }

  async signOut() {
    try {
      await this.auth.signOut();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Sign out failed', error);
    }
  }

  private async checkUserInit(uid: string) {
    this.isCheckingInit = true;
    try {
      const profile = await this.userService.getUserProfile(uid);

      // Only show for clients
      const role = profile?.['role'] || 'client';
      if (role !== 'client') {
        this.isCheckingInit = false;
        this.showAccountInit = false;
        return;
      }

      // Check for USA agreement in profile (usa map with usaStatus)
      const usaAgreed = profile?.['usa']?.['usaStatus'] === 'agreed';
      this.showAccountInit = !usaAgreed;
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
    const user = this.auth.currentUser;
    if (user) {
      this.checkUserInit(user.uid);
    }
  }
}

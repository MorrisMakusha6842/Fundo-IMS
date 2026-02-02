import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AccountInitialisingComponent } from './account-initialising.component';
import { NotificationIconComponent } from '../shared/notification-icon/notification-icon.component';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { Firestore } from '@angular/fire/firestore';
import { RemindersService } from '../services/reminders.service';
import { take } from 'rxjs/operators';

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
  private remindersService = inject(RemindersService);

  // Expose user role for template
  userRole$ = this.auth.userRole$;

  constructor() { }

  ngOnInit() {
    // subscribe to auth user to show photo and name if available
    this.auth.user$.subscribe(async u => {
      if (u) {
        // Fetch latest profile data from Firestore to ensure avatar is sync'd
        try {
          const profile = await this.userService.getUserProfile(u.uid);
          // Prioritize avatarDataUrl from Firestore, fallback to Auth photoURL
          this.userPhotoUrl = profile?.['avatarDataUrl'] || profile?.['photoURL'] || u.photoURL;
          this.userDisplayName = profile?.['displayName'] || u.displayName || u.email;
        } catch (e) {
          this.userPhotoUrl = u.photoURL;
          this.userDisplayName = u.displayName || u.email;
        }
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

      const usaAgreed = profile?.['usa']?.['usaStatus'] === 'agreed';
      this.showAccountInit = !usaAgreed;

      if (usaAgreed) {
        // User is already initialized, check if they have any missing asset docs
        this.toast.checkAssetCompliance(uid);
        this.checkReminders(uid);
      }
    } catch (err) {
      console.warn('Failed to check user init', err);
      // be conservative: if we cannot check, don't block access; hide modal
      this.showAccountInit = false;
    } finally {
      this.isCheckingInit = false;
    }
  }

  private checkReminders(uid: string) {
    this.remindersService.getReminders().pipe(take(1)).subscribe(reminders => {
      const now = new Date();
      const warningThreshold = new Date();
      warningThreshold.setDate(now.getDate() + 14); // Warn 14 days in advance

      let expiryCount = 0;
      reminders.forEach(r => {
        const due = r.dueDate.toDate ? r.dueDate.toDate() : new Date(r.dueDate);
        if (r.type === 'asset_expiry' && due > now && due <= warningThreshold) {
          expiryCount++;
        }
      });

      if (expiryCount > 0) {
        this.toast.show(`You have ${expiryCount} assets expiring soon. Check Reminders.`, 'warn', 10000, true, 'Expiries Detected', () => {
          this.router.navigate(['/main-layout/reminders']);
        });
      }
    });
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

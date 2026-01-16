import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
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

  constructor(private auth: AuthService, private toast: ToastService, private router: Router) {
    // subscribe to auth user to show photo and name if available
    this.auth.user$.subscribe(u => {
      this.userPhotoUrl = u?.photoURL || null;
      this.userDisplayName = u?.displayName || u?.email || 'User';
    });
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

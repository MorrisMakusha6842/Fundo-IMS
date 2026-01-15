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

  constructor(private auth: AuthService, private toast: ToastService, private router: Router) {
    // subscribe to auth user to show photo if available
    this.auth.user$.subscribe(u => {
      this.userPhotoUrl = u?.photoURL || null;
    });
  }

  navigateTo(path: string) {
    // convenience router wrapper for sidebar links
    this.router.navigate([path]);
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

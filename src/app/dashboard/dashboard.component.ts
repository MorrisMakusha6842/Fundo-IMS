import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);

  displayName: string = '';
  isLoadingProfile: boolean = true;

  // Dummy Data for UI
  kpiData = {
    totalUsers: 1284,
    registeredVehicles: 3762,
    expiringPolicies: 146,
    revenue: 248900,
    pendingRenewals: 89
  };

  newlyRegisteredVehicles = [
    { id: 'ZW-7843', vehicle: 'Toyota Hilux', client: 'Makoni Holdings', status: 'Pending', submitted: 'Today' },
    { id: 'ZW-9921', vehicle: 'Honda Fit', client: 'Sarah James', status: 'Approved', submitted: 'Yesterday' },
    { id: 'ZW-1102', vehicle: 'Nissan NP200', client: 'Tech Solutions', status: 'Rejected', submitted: '2 days ago' }
  ];

  activityLog = [
    { action: 'Policy renewed for vehicle ZW-7843', source: 'System', time: '2 hours ago' },
    { action: 'New insurance policy registered', source: 'Admin', time: 'Today' },
    { action: 'Policy expired – renewal reminder sent', source: 'Automated', time: 'Yesterday' },
    { action: 'Claim #CLM-0098 approved', source: 'Agent', time: '3 days ago' }
  ];

  ngOnInit() {
    this.fetchUserProfile();
  }

  async fetchUserProfile() {
    this.isLoadingProfile = true;
    const user = this.authService.currentUser;
    if (user?.uid) {
      try {
        const profile = await this.userService.getUserProfile(user.uid);
        if (profile) {
          this.displayName = profile['displayName'];
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }
    this.isLoadingProfile = false;
  }
}

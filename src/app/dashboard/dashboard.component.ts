import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { AssetsService } from '../services/assets.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private assetsService = inject(AssetsService);
  private router = inject(Router);

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

  newlyRegisteredVehicles: any[] = [];
  isLoadingVehicles: boolean = true;
  private assetsSubscription?: Subscription;

  activityLog = [
    { action: 'Policy renewed for vehicle ZW-7843', source: 'System', time: '2 hours ago' },
    { action: 'New insurance policy registered', source: 'Admin', time: 'Today' },
    { action: 'Policy expired – renewal reminder sent', source: 'Automated', time: 'Yesterday' },
    { action: 'Claim #CLM-0098 approved', source: 'Agent', time: '3 days ago' }
  ];

  ngOnInit() {
    this.fetchUserProfile();
    this.fetchNewlyRegisteredVehicles();
  }

  ngOnDestroy() {
    this.assetsSubscription?.unsubscribe();
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

  fetchNewlyRegisteredVehicles() {
    this.isLoadingVehicles = true;
    this.assetsSubscription = this.assetsService.getAllVehicles().subscribe(async (assets) => {
      const oneWeekAgo = new Date();
      oneWeekAgo.setHours(oneWeekAgo.getHours() - 168);

      const pendingAssets = assets.filter(asset => {
        // Filter by status 'Pending'
        if (asset.status !== 'Pending') return false;

        // Filter by recently uploaded documents (last 168 hours)
        if (!asset.documents || asset.documents.length === 0) return false;

        return asset.documents.some((doc: any) => {
          if (!doc.uploadedAt) return false;
          return new Date(doc.uploadedAt) > oneWeekAgo;
        });
      });

      // Map to display format
      this.newlyRegisteredVehicles = await Promise.all(pendingAssets.map(async (asset) => {
        let clientName = 'Unknown';
        const userId = asset.uid || asset.userId;

        if (userId) {
          try {
            const profile = await this.userService.getUserProfile(userId);
            if (profile) {
              clientName = profile['displayName'] || profile['email'] || 'Unknown';
            }
          } catch (e) {
            console.error('Error fetching client name', e);
          }
        }

        // Determine submission time based on most recent document upload
        let submittedStr = 'Unknown';
        if (asset.documents && asset.documents.length > 0) {
          const sortedDocs = [...asset.documents].sort((a: any, b: any) => {
            const dateA = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
            const dateB = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
            return dateB - dateA;
          });
          const latestDate = sortedDocs[0].uploadedAt ? new Date(sortedDocs[0].uploadedAt) : null;
          if (latestDate) submittedStr = this.formatDateRelative(latestDate);
        }

        return {
          id: asset.numberPlate || 'N/A',
          vehicle: `${asset.year} ${asset.make}`,
          client: clientName,
          status: asset.status,
          submitted: submittedStr,
          rawAsset: asset
        };
      }));

      this.isLoadingVehicles = false;
    });
  }

  formatDateRelative(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }
}

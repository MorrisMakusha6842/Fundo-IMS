import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { AssetsService } from '../services/assets.service';
import { AccountReceivableService } from '../financial-insight/account-receivable.service';
import { Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
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
  private accountReceivableService = inject(AccountReceivableService);
  private router = inject(Router);

  displayName: string = '';
  userPhotoUrl: string | null = null;
  isLoadingProfile: boolean = true;

  // Dummy Data for UI
  kpiData = {
    totalUsers: 0,
    registeredAssets: 0,
    expiringPolicies: 0,
    revenue: 0,
    pendingRenewals: 89
  };

  newlyRegisteredVehicles: any[] = [];
  isLoadingVehicles: boolean = true;
  private assetsSubscription?: Subscription;
  private usersSubscription?: Subscription;
  private revenueSubscription?: Subscription;
  private userSubscription?: Subscription;

  activityLog = [
    { action: 'Policy renewed for vehicle ZW-7843', source: 'System', time: '2 hours ago' },
    { action: 'New insurance policy registered', source: 'Admin', time: 'Today' },
    { action: 'Policy expired – renewal reminder sent', source: 'Automated', time: 'Yesterday' },
    { action: 'Claim #CLM-0098 approved', source: 'Agent', time: '3 days ago' }
  ];

  ngOnInit() {
    // Subscribe to user changes to handle page refreshes reliably
    this.userSubscription = this.authService.user$.subscribe(user => {
      if (user) {
        this.fetchUserProfile(user.uid);
      }
    });

    this.fetchTotalUsers();
    this.fetchAssetsData();
    this.fetchRevenueData();
  }

  ngOnDestroy() {
    this.assetsSubscription?.unsubscribe();
    this.usersSubscription?.unsubscribe();
    this.revenueSubscription?.unsubscribe();
    this.userSubscription?.unsubscribe();
  }

  fetchTotalUsers() {
    this.usersSubscription = this.userService.getAllUsers().subscribe((users) => {
      this.kpiData.totalUsers = users.length;
    });
  }

  async fetchUserProfile(uid?: string) {
    this.isLoadingProfile = true;
    const userId = uid || this.authService.currentUser?.uid;
    if (userId) {
      try {
        const profile = await this.userService.getUserProfile(userId);
        if (profile) {
          this.displayName = profile['displayName'];
          this.userPhotoUrl = profile['photoURL'] || profile['avatarDataUrl'];
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    }
    this.isLoadingProfile = false;
  }

  fetchRevenueData() {
    this.revenueSubscription = this.authService.userRole$.pipe(
      switchMap(role => {
        const user = this.authService.currentUser;
        if (!user) return of([]);
        return (role === 'admin' || role === 'agent')
          ? this.accountReceivableService.getAllPayments()
          : this.accountReceivableService.getUserPayments(user.uid);
      })
    ).subscribe(payments => {
      // Sum up the 'amount' field from all payment records
      this.kpiData.revenue = payments.reduce((sum, record) => sum + (Number(record.amount) || 0), 0);
    });
  }

  fetchAssetsData() {
    this.isLoadingVehicles = true;
    this.assetsSubscription = this.authService.userRole$.pipe(
      switchMap(role => {
        const user = this.authService.currentUser;
        if (!user) return of([]);
        return (role === 'admin' || role === 'agent')
          ? this.assetsService.getAllVehicles()
          : this.assetsService.getUserVehicles(user.uid);
      })
    ).subscribe(async (assets) => {
      // 1. Update Registered Assets KPI
      this.kpiData.registeredAssets = assets.length;

      // 2. Update Expiring Policies KPI
      let expiringCount = 0;

      assets.forEach(asset => {
        if (asset.documents && Array.isArray(asset.documents)) {
          asset.documents.forEach((doc: any) => {
            if (doc.expiryDate) {
              expiringCount++;
            }
          });
        }
      });
      this.kpiData.expiringPolicies = expiringCount;

      // 3. Update Newly Registered Vehicles Table
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

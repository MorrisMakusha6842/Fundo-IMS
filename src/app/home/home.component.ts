import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PolicyService } from '../services/policy.service';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { AssetsService, VehicleAsset } from '../services/assets.service';
import { Observable, BehaviorSubject, of, combineLatest } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { PolicyDetailModalComponent } from './policy-detail-modal.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule, PolicyDetailModalComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private policyService = inject(PolicyService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private assetsService = inject(AssetsService);
  private firestore = inject(Firestore);
  private router = inject(Router);

  displayName: string = '';
  isLoadingProfile: boolean = true;
  subCategories$: Observable<any[]> | undefined;
  filteredPolicies$: Observable<any[]> | undefined;
  userAssets$: Observable<VehicleAsset[]> | undefined;
  paginatedAssets: VehicleAsset[] = [];

  // Pagination State
  assetPage: number = 1;
  assetPageSize: number = 8;
  totalAssets: number = 0;
  totalAssetPages: number = 0;
  isLoadingAssets: boolean = true;

  selectedCategorySubject = new BehaviorSubject<string | null>(null);
  selectedCategory$ = this.selectedCategorySubject.asObservable();

  selectedAsset: VehicleAsset | null = null;
  claimDescription: string = '';
  claimType: string = 'Accident'; // Default

  // Accordion State
  isActiveExpanded: boolean = true;
  isExpiringExpanded: boolean = false;
  isLapsedExpanded: boolean = false;

  // Policy Data
  activePolicies: any[] = [];
  lapsedPolicies: any[] = [];

  // Policy Modal State
  selectedPolicy: any = null;

  ngOnInit() {
    this.subCategories$ = this.policyService.getSubCategories();

    this.filteredPolicies$ = this.selectedCategory$.pipe(
      switchMap(categoryId => {
        if (!categoryId) {
          return this.policyService.getAllPolicies();
        } else {
          // Fetch policies for specific sub-category
          return this.policyService.getPoliciesBySubCategory(categoryId);
        }
      }),
      catchError(err => {
        console.error('Error fetching policies:', err);
        return of([]);
      })
    );

    // Fetch assets and policies based on role
    combineLatest([
      this.authService.user$,
      this.authService.userRole$
    ]).pipe(
      switchMap(([user, role]) => {
        this.isLoadingAssets = true;
        if (!user) return of([]);

        this.fetchUserProfile(user.uid);

        if (role === 'admin' || role === 'agent') {
          return this.assetsService.getAllVehicles();
        }
        return this.assetsService.getUserVehicles(user.uid);
      })
    ).subscribe(assets => {
      this.availableAssets = assets;
      this.processAssetsForPolicies(assets);
      this.totalAssets = assets.length;
      this.totalAssetPages = Math.ceil(this.totalAssets / this.assetPageSize);
      this.userAssets$ = of(assets);
      this.updateAssetPagination(assets);
      this.isLoadingAssets = false;
    });
  }

  async fetchUserProfile(uid: string) {
    this.isLoadingProfile = true;
    try {
      const profile = await this.userService.getUserProfile(uid);
      if (profile) {
        this.displayName = profile['displayName'];
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      this.isLoadingProfile = false;
    }
  }

  processAssetsForPolicies(assets: VehicleAsset[]) {
    this.activePolicies = [];
    this.lapsedPolicies = [];

    const now = new Date();
    const warningThreshold = new Date();
    warningThreshold.setDate(now.getDate() + 30); // 30 days warning

    assets.forEach(asset => {
      if (asset.documents) {
        asset.documents.forEach((doc: any) => {
          if (doc.field === 'Insurance Policy') {
            // Process dataUrl if needed (handle Firestore Bytes)
            let docUrl = doc.dataUrl;
            if (!docUrl && doc.storageData && typeof doc.storageData.toBase64 === 'function') {
              docUrl = `data:${doc.type};base64,${doc.storageData.toBase64()}`;
            }

            const policy = {
              policyId: doc.name, // Using filename as ID for now
              policyName: 'Insurance Policy',
              asset: `${asset.make} ${asset.numberPlate}`,
              expiryDate: doc.expiryDate,
              status: 'Active',
              docUrl: docUrl
            };

            if (doc.expiryDate) {
              const expiry = new Date(doc.expiryDate);
              if (expiry < now) {
                policy.status = 'Lapsed';
                this.lapsedPolicies.push(policy);
              } else {
                this.activePolicies.push(policy);
              }
            } else {
              this.activePolicies.push(policy);
            }
          }
        });
      }
    });
  }

  toggleActive() { this.isActiveExpanded = !this.isActiveExpanded; }
  toggleLapsed() { this.isLapsedExpanded = !this.isLapsedExpanded; }

  updateAssetPagination(allAssets: VehicleAsset[]) {
    const startIndex = (this.assetPage - 1) * this.assetPageSize;
    const endIndex = startIndex + this.assetPageSize;
    this.paginatedAssets = allAssets.slice(startIndex, endIndex);
  }

  nextAssetPage() {
    if (this.assetPage < this.totalAssetPages) {
      this.changeAssetPage(1);
    }
  }

  prevAssetPage() {
    if (this.assetPage > 1) {
      this.changeAssetPage(-1);
    }
  }

  // Refactored Pagination Logic needed to access 'allAssets'
  public availableAssets: VehicleAsset[] = [];

  selectCategory(categoryId: string) {
    const current = this.selectedCategorySubject.value;
    if (current === categoryId) {
      this.selectedCategorySubject.next(null); // Deselect
    } else {
      this.selectedCategorySubject.next(categoryId);
    }
  }

  onSelectAsset(asset: VehicleAsset) {
    this.selectedAsset = asset;
  }

  // Placeholder Logic for Table Columns
  hasAppliedPolicy(asset: VehicleAsset): boolean {
    // Check if documents array contains an Insurance Policy
    return !!asset.documents?.some((doc: any) => doc.field === 'Insurance Policy');
  }

  getExpiryStatus(asset: VehicleAsset): 'UP TO DATE' | 'ATTENTION NEEDED' {
    const policyDoc = asset.documents?.find((doc: any) => doc.field === 'Insurance Policy');

    if (!policyDoc || !policyDoc.expiryDate) return 'ATTENTION NEEDED';

    const expiry = new Date(policyDoc.expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Warning if less than 7 days remaining
    return diffDays > 7 ? 'UP TO DATE' : 'ATTENTION NEEDED';
  }

  changeAssetPage(offset: number) {
    const newPage = this.assetPage + offset;
    if (newPage >= 1 && newPage <= this.totalAssetPages) {
      this.assetPage = newPage;
      this.updateAssetPagination(this.availableAssets);
    }
  }

  onSubmitClaim() {
    if (!this.selectedAsset) {
      alert('Please select an asset to claim.');
      return;
    }
    console.log('Submitting Claim:', {
      asset: this.selectedAsset,
      type: this.claimType,
      description: this.claimDescription
    });
    // Here you would call a service to save the claim
    alert(`Claim submitted for ${this.selectedAsset.make} (${this.selectedAsset.numberPlate})`);

    // Reset form
    this.selectedAsset = null;
    this.claimDescription = '';
    this.claimType = 'Accident';
  }

  navigateToAssetRegistry(event: Event) {
    event.stopPropagation();
    this.router.navigate(['/main-layout/asset-registry']);
  }

  navigateTo(path: string) {
    this.router.navigate([path]);
  }

  openPolicyModal(policy: any) {
    this.selectedPolicy = policy;
  }

  closePolicyModal() {
    this.selectedPolicy = null;
  }
}

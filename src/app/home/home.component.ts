import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PolicyService } from '../services/policy.service';
import { AuthService } from '../services/auth.service';
import { AssetsService, VehicleAsset } from '../services/assets.service';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private policyService = inject(PolicyService);
  private authService = inject(AuthService);
  private assetsService = inject(AssetsService);
  private firestore = inject(Firestore);

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

  ngOnInit() {
    this.subCategories$ = this.policyService.getSubCategories();

    this.filteredPolicies$ = this.selectedCategory$.pipe(
      switchMap(categoryId => {
        if (!categoryId) {
          return this.policyService.getAllPolicies();
        } else {
          // Fetch policies for specific sub-category
          const colRef = collection(this.firestore, `sub-categories/${categoryId}/policies`);
          return collectionData(colRef, { idField: 'id' });
        }
      }),
      catchError(err => {
        console.error('Error fetching policies:', err);
        return of([]);
      })
    );

    // Fetch user assets
    this.authService.user$.pipe(
      switchMap(user => {
        this.isLoadingAssets = true;
        if (user?.uid) {
          return this.assetsService.getUserVehicles(user.uid);
        } else {
          return of([]);
        }
      })
    ).subscribe(assets => {
      this.allUserAssets = assets;
      this.totalAssets = assets.length;
      this.totalAssetPages = Math.ceil(this.totalAssets / this.assetPageSize);
      this.userAssets$ = of(assets);
      this.updateAssetPagination(assets);
      this.isLoadingAssets = false;
    });
  }

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
  private allUserAssets: VehicleAsset[] = [];

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
    // Check if policyDeploymentDate exists and is valid
    return !!asset.policyDeploymentDate;
  }

  getExpiryStatus(asset: VehicleAsset): 'UP TO DATE' | 'ATTENTION NEEDED' {
    if (!asset.policyExpiryDate) return 'ATTENTION NEEDED';

    const expiry = new Date(asset.policyExpiryDate);
    const today = new Date();
    // Simple check: if expiry is in future -> Up to date
    return expiry > today ? 'UP TO DATE' : 'ATTENTION NEEDED';
  }

  changeAssetPage(offset: number) {
    const newPage = this.assetPage + offset;
    if (newPage >= 1 && newPage <= this.totalAssetPages) {
      this.assetPage = newPage;
      this.updateAssetPagination(this.allUserAssets);
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
}

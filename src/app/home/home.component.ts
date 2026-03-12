import { Component, OnInit, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PolicyService } from '../services/policy.service';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { AssetsService, VehicleAsset } from '../services/assets.service';
import { ToastService } from '../services/toast.service';
import { ClaimsService } from '../services/claims.service';
import { FinancialInsightService } from '../financial-insight/financial-insight.service';
import { Observable, BehaviorSubject, of, combineLatest, firstValueFrom } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { FormsModule } from '@angular/forms';
import { PolicyDetailModalComponent } from './policy-detail-modal.component';
import { BillingDebitComponent } from '../billing/billing-debit.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, FormsModule, PolicyDetailModalComponent, BillingDebitComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private policyService = inject(PolicyService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private assetsService = inject(AssetsService);
  private claimsService = inject(ClaimsService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);
  private financialService = inject(FinancialInsightService);

  displayName: string = '';
  userPhotoUrl: string | null = null;
  isLoadingProfile: boolean = true;
  subCategories$: Observable<any[]> | undefined;
  filteredPolicies$: Observable<any[]> | undefined;  
  isLoadingAssets: boolean = true;

  selectedCategorySubject = new BehaviorSubject<string | null>(null);
  selectedCategory$ = this.selectedCategorySubject.asObservable();

  // New properties for the overview table
  overviewDocuments: any[] = [];
  paginatedOverviewDocuments: any[] = [];
  overviewPage = 1;
  overviewPageSize = 5; // You can adjust this
  totalOverviewDocs = 0;
  totalOverviewPages = 0;

  // Accordion State
  isActiveExpanded: boolean = false;
  isExpiringExpanded: boolean = false;
  isLapsedExpanded: boolean = false;

  // Policy Data
  activePolicies: any[] = [];
  lapsedPolicies: any[] = [];

  // Policy Modal State
  selectedPolicy: any = null;

  // 3. Add these new properties to your class
  isBillingDebitModalOpen = false;
  purchaseData: any = null;

  // Financial Data for price calculation
  currentTaxRate = 0;
  currentFxRate = 0;

  // ... your existing methods

  // 4. Add these new methods to handle the modal flow
  handlePurchase(data: any) {
    // Enrich data with client name for Invoice generation later
    this.purchaseData = {
      ...data,
      clientName: this.displayName || 'Valued Client'
    };
    this.closePolicyModal(); // Close the details modal
    this.isBillingDebitModalOpen = true; // Open the new billing modal
  }

  closeBillingDebitModal() {
    this.isBillingDebitModalOpen = false;
    this.purchaseData = null;
  }

  ngOnInit() {
    this.loadFinancialData();
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
      this.processAssetsForOverview(assets);
      this.isLoadingAssets = false;
    });

    // Listen for fragment to scroll to policies (e.g. from "Purchase" tag or external link)
    this.route.fragment.subscribe(fragment => {
      if (fragment === 'available-policies') {
        setTimeout(() => this.scrollToPolicies(), 600);
      }
    });
  }

  async loadFinancialData() {
    try {
      const record = await this.financialService.getLatestRecord();
      if (record) {
        this.currentTaxRate = record.currentTaxRate || 0;
        this.currentFxRate = record.currentFxRate || 0;
      }
    } catch (error) {
      console.error('Error fetching financial data for home component:', error);
    }
  }

  async fetchUserProfile(uid: string) {
    this.isLoadingProfile = true;
    try {
      const profile = await this.userService.getUserProfile(uid);
      if (profile) {
        this.displayName = (profile['displayName'] || '').trim();
        this.userPhotoUrl = profile['photoURL'] || profile['avatarDataUrl'];
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      this.isLoadingProfile = false;
    }
  }

  processAssetsForOverview(assets: VehicleAsset[]) {
    const relevantDocTypes = ['Vehicle Registration Book', 'Radio License', 'Insurance Policy'];
    const docs: any[] = [];
    const now = new Date();

    assets.forEach(asset => {
      if (asset.documents && asset.documents.length > 0) {
        asset.documents.forEach((doc: any) => {
          if (relevantDocTypes.includes(doc.field)) {
            let daysUntilExpiry: number | null = null;
            let statusText = 'Valid';
            let severity = 'green';

            if (doc.expiryDate) {
              const expiry = new Date(doc.expiryDate);
              const diffTime = expiry.getTime() - now.getTime();
              daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (daysUntilExpiry <= 0) {
                statusText = 'Expired';
                severity = 'red';
              } else {
                statusText = `Expires in ${daysUntilExpiry} days`;
                if (daysUntilExpiry <= 7) {
                  severity = 'red';
                } else if (daysUntilExpiry <= 30) {
                  severity = 'orange';
                }
              }
            }

            docs.push({ asset, document: doc, daysUntilExpiry, statusText, severity });
          }
        });
      }
    });

    // Sort by expiry date, soonest first
    this.overviewDocuments = docs.sort((a, b) => (a.daysUntilExpiry ?? 9999) - (b.daysUntilExpiry ?? 9999));

    this.totalOverviewDocs = this.overviewDocuments.length;
    this.totalOverviewPages = Math.ceil(this.totalOverviewDocs / this.overviewPageSize);
    this.updateOverviewPagination();
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
              asset: `${asset.make} ${asset.vehicleRegistrationNumber}`,
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

  updateOverviewPagination() {
    const startIndex = (this.overviewPage - 1) * this.overviewPageSize;
    const endIndex = startIndex + this.overviewPageSize;
    this.paginatedOverviewDocuments = this.overviewDocuments.slice(startIndex, endIndex);
  }

  nextOverviewPage() {
    if (this.overviewPage < this.totalOverviewPages) {
      this.overviewPage++;
      this.updateOverviewPagination();
    }
  }

  prevOverviewPage() {
    if (this.overviewPage > 1) {
      this.overviewPage--;
      this.updateOverviewPagination();
    }
  }
  // Refactored Pagination Logic needed to access 'allAssets'
  public availableAssets: VehicleAsset[] = [];

  selectCategory(categoryId: string | null) {
    const current = this.selectedCategorySubject.value;
    if (current === categoryId) {
      this.selectedCategorySubject.next(null); // Deselect
    } else {
      this.selectedCategorySubject.next(categoryId);
    }
  }

  scrollToPolicies() {
    const policiesSection = document.getElementById('available-policies');
    if (policiesSection) {
      policiesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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

  calculatePolicyPrice(policy: any): number {
    if (!policy?.packages?.length) {
      return 0;
    }

    const isRenewal = (policy.policyType || '').toLowerCase() === 'renewal';
    // We'll calculate the price based on the first package, as that's what the card implies.
    const pkg = policy.packages[0];

    let total = pkg.price || 0;

    // Sum up fixed-amount coverages. Percentage-based ones can't be calculated without an asset.
    if (pkg.coverages && Array.isArray(pkg.coverages)) {
      pkg.coverages.forEach((cov: any) => {
        if (cov && typeof cov === 'object' && cov.amount) {
          total += cov.amount;
        }
      });
    }

    // For renewals, tax is applied on the total of package price and fixed coverages.
    if (isRenewal && this.currentTaxRate > 0) {
      total += total * (this.currentTaxRate / 100);
    }

    return total;
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { PolicyService } from '../services/policy.service';
import { ToastService } from '../services/toast.service';
import { Observable, tap, combineLatest, map, startWith } from 'rxjs';
import { serverTimestamp } from 'firebase/firestore';

@Component({
  selector: 'app-policies',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './policies.component.html',
  styleUrl: './policies.component.scss'
})
export class PoliciesComponent implements OnInit {
  // Modal States
  isSubCategoryModalOpen = false;
  isSubCategoryListModalOpen = false;
  isCreatePolicyModalOpen = false;
  isEditPolicyModalOpen = false;
  isSubmitting = false;
  isLoading = true;

  // Data
  subCategories$: Observable<any[]>;
  policies$: Observable<any[]>;
  filteredPolicies$: Observable<any[]>;
  private subCategoriesList: any[] = [];

  // KPIs
  totalPolicies = 0;
  activePolicies = 0;

  // Forms
  subCategoryForm: FormGroup;
  createPolicyForm: FormGroup;
  searchControl = new FormControl('');
  selectedPolicy: any = null;
  editStatusControl = new FormControl('active');

  private toast = inject(ToastService);


  // --- Renewals Logic ---
  isRenewalsModalOpen = false;
  isLoadingRenewals = false;
  allRenewals: any[] = []; // Master list
  filteredRenewals: any[] = []; // Filtered by type/search
  paginatedRenewals: any[] = []; // Current page
  renewalPage = 1;
  renewalPageSize = 10;
  totalRenewalPages = 0;

  renewalFilterType: 'insurance' | 'radio' = 'insurance';
  renewalSearchControl = new FormControl('');

  constructor(
    private fb: FormBuilder,
    private policyService: PolicyService
  ) {
    this.subCategoryForm = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });

    this.createPolicyForm = this.fb.group({
      subCategory: ['', Validators.required],
      policyName: ['', Validators.required],
      policyType: ['standard', Validators.required],
      // tenure expected as number of months (integers). We'll store server timestamp + months in Firestore.
      tenure: ['', [Validators.required, Validators.pattern('^[0-9]+$')]],
      packages: this.fb.array([])
    });

    this.subCategories$ = this.policyService.getSubCategories();

    // Combine policies with search control for filtering and KPI calculation
    this.policies$ = this.policyService.getAllPolicies();

    this.filteredPolicies$ = combineLatest([
      this.policies$,
      this.searchControl.valueChanges.pipe(startWith(''))
    ]).pipe(
      map(([policies, searchTerm]) => {
        this.totalPolicies = policies.length;
        this.activePolicies = policies.filter(p => p.status?.toLowerCase() === 'active').length;
        const term = (searchTerm || '').toLowerCase();
        return policies.filter(p => p.policyName?.toLowerCase().includes(term));
      }),
      tap(() => this.isLoading = false)
    );

    // Setup Renewal Search
    this.renewalSearchControl.valueChanges.subscribe(() => {
      this.filterRenewals();
    });
  }

  ngOnInit(): void {
    // Cache sub-categories for name lookup during creation
    this.subCategories$.subscribe(data => this.subCategoriesList = data);
  }

  // --- Modal Handlers ---
  openSubCategoryModal() { this.isSubCategoryModalOpen = true; }
  closeSubCategoryModal() { this.isSubCategoryModalOpen = false; this.subCategoryForm.reset(); }

  openSubCategoryListModal() { this.isSubCategoryListModalOpen = true; }
  closeSubCategoryListModal() { this.isSubCategoryListModalOpen = false; }

  openCreatePolicyModal() {
    this.isCreatePolicyModalOpen = true;
    // Initialize with one default package
    if (this.packages.length === 0) {
      this.addPackage();
    }
  }

  closeCreatePolicyModal() {
    this.isCreatePolicyModalOpen = false;
    this.createPolicyForm.reset();
    this.packages.clear();
  }

  openEditPolicyModal(policy: any) {
    this.selectedPolicy = policy;
    this.editStatusControl.setValue(policy.status || 'active');
    this.isEditPolicyModalOpen = true;
  }

  closeEditPolicyModal() {
    this.isEditPolicyModalOpen = false;
    this.selectedPolicy = null;
  }

  async onUpdatePolicyStatus() {
    if (!this.selectedPolicy) return;
    try {
      await this.policyService.updatePolicy(this.selectedPolicy.subCategoryId, this.selectedPolicy.id, {
        status: this.editStatusControl.value
      });
      this.toast.show('Policy status updated', 'success');
      this.closeEditPolicyModal();
    } catch (error) {
      console.error('Error updating policy', error);
      this.toast.show('Failed to update status', 'error');
    }
  }

  // --- Form Arrays for Packages ---
  get packages(): FormArray {
    return this.createPolicyForm.get('packages') as FormArray;
  }

  addPackage() {
    const pkgGroup = this.fb.group({
      name: ['', Validators.required],
      coverages: this.fb.array([]),
      flatFees: this.fb.array([])
    });
    this.packages.push(pkgGroup);

    // Add default empty rows for better UX
    this.addCoverage(this.packages.length - 1);
    this.addFee(this.packages.length - 1);
  }

  removePackage(index: number) {
    this.packages.removeAt(index);
  }

  // --- Nested Form Arrays Helpers ---
  getPackageCoverages(packageIndex: number): FormArray {
    return this.packages.at(packageIndex).get('coverages') as FormArray;
  }

  getPackageFees(packageIndex: number): FormArray {
    return this.packages.at(packageIndex).get('flatFees') as FormArray;
  }

  addCoverage(packageIndex: number) {
    this.getPackageCoverages(packageIndex).push(this.fb.group({
      name: ['', Validators.required],
      percentage: [100, [Validators.required, Validators.min(0), Validators.max(100)]]
    }));
  }

  removeCoverage(packageIndex: number, coverageIndex: number) {
    this.getPackageCoverages(packageIndex).removeAt(coverageIndex);
  }

  addFee(packageIndex: number) {
    this.getPackageFees(packageIndex).push(this.fb.group({
      name: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]]
    }));
  }

  removeFee(packageIndex: number, feeIndex: number) {
    this.getPackageFees(packageIndex).removeAt(feeIndex);
  }

  // --- Logic ---

  async onCreateSubCategory() {
    if (this.subCategoryForm.invalid) return;
    this.isSubmitting = true;
    const { name, description } = this.subCategoryForm.value;

    try {
      await this.policyService.addSubCategory({
        name,
        description,
        createdAt: new Date(),
        status: 'active'
      });
      this.toast.show('Sub-category created successfully', 'success');
      this.closeSubCategoryModal();
    } catch (error) {
      console.error('Error creating sub category:', error);
      this.toast.show('Failed to create sub-category', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  async onCreatePolicy() {
    if (this.createPolicyForm.invalid) {
      // mark fields so any inline errors (if added later) show up and give immediate feedback
      this.createPolicyForm.markAllAsTouched();
      this.toast.show('Please fill the required fields correctly before creating the policy.', 'error');
      return;
    }
    this.isSubmitting = true;
    const { subCategory, policyName, policyType, tenure, packages } = this.createPolicyForm.value;

    // tenure should be integer months; ensure it's numeric
    const tenureMonths = Number(tenure);
    if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) {
      this.toast.show('Tenure must be a whole number of months (e.g. 12).', 'error');
      this.isSubmitting = false;
      return;
    }

    // Find the name of the selected sub-category to store on the policy for easier display
    const selectedSub = this.subCategoriesList.find(s => s.id === subCategory);
    const subCategoryName = selectedSub ? selectedSub.name : 'Unknown';

    try {
      // subCategory is the ID of the selected category
      // Validate packages (names, numeric ranges) and normalize values
      for (let pIndex = 0; pIndex < (packages || []).length; pIndex++) {
        const pkg = packages[pIndex];
        if (!pkg.name || !pkg.name.trim()) {
          this.toast.show(`Package ${pIndex + 1} needs a name.`, 'error');
          this.isSubmitting = false;
          return;
        }

        const covs = pkg.coverages || [];
        for (let cIndex = 0; cIndex < covs.length; cIndex++) {
          const cov = covs[cIndex];
          const pct = Number(cov.percentage);
          if (cov.name == null || cov.name.toString().trim() === '') {
            this.toast.show(`Coverage #${cIndex + 1} in package "${pkg.name}" needs a name.`, 'error');
            this.isSubmitting = false;
            return;
          }
          if (isNaN(pct) || pct < 0 || pct > 100) {
            this.toast.show(`Coverage "${cov.name}" in package "${pkg.name}" must have a percentage between 0 and 100.`, 'error');
            this.isSubmitting = false;
            return;
          }
        }

        const fees = pkg.flatFees || [];
        for (let fIndex = 0; fIndex < fees.length; fIndex++) {
          const fee = fees[fIndex];
          const amt = Number(fee.amount);
          if (fee.name == null || fee.name.toString().trim() === '') {
            this.toast.show(`Fee #${fIndex + 1} in package "${pkg.name}" needs a name.`, 'error');
            this.isSubmitting = false;
            return;
          }
          if (isNaN(amt) || amt < 0) {
            this.toast.show(`Fee "${fee.name}" in package "${pkg.name}" must have a valid amount (>= 0).`, 'error');
            this.isSubmitting = false;
            return;
          }
        }
      }

      const normalizedPackages = (packages || []).map((pkg: any) => {
        const normCoverages = (pkg.coverages || []).map((c: any) => ({
          name: c.name,
          percentage: Number(c.percentage)
        }));

        // Treat flatFees as coverages as requested: convert each fee into a coverage-like entry
        const feeAsCoverages = (pkg.flatFees || []).map((f: any) => ({
          name: f.name,
          amount: Number(f.amount)
        }));

        // Destructure to separate flatFees from the rest of the package properties
        const { flatFees, ...restPkg } = pkg;

        return {
          ...restPkg,
          // merged coverages array contains both percentage-based coverages and fee-based coverages
          coverages: [...normCoverages, ...feeAsCoverages]
        } as any;
      });

      // Use Firestore serverTimestamp for createdAt and tenureStart so server time is recorded.
      // Also store tenureMonths so other parts of the system can compute expiry reliably.
      await this.policyService.addPolicy(subCategory, {
        policyName,
        policyType,
        // keep legacy `tenure` string for compatibility with PolicyData
        tenure: String(tenure),
        tenureMonths,
        tenureStart: serverTimestamp(),
        packages: normalizedPackages,
        subCategoryId: subCategory,
        subCategoryName: subCategoryName,
        createdAt: serverTimestamp(),
        status: 'active'
      });
      this.toast.show('Policy created successfully', 'success');
      this.closeCreatePolicyModal();
    } catch (error) {
      console.error('Error creating policy:', error);
      this.toast.show('Failed to create policy', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  async onDeleteSubCategory(id: string) {
    if (confirm('Are you sure you want to delete this sub-category?')) {
      try {
        await this.policyService.deleteSubCategory(id);
        this.toast.show('Sub-category deleted', 'success');
      } catch (error) {
        console.error('Error deleting sub-category:', error);
        this.toast.show('Failed to delete sub-category', 'error');
      }
    }
  }

  async onDeletePolicy(policy: any) {
    if (confirm('Are you sure you want to delete this policy?')) {
      try {
        await this.policyService.deletePolicy(policy.subCategoryId, policy.id);
        this.toast.show('Policy deleted', 'success');
      } catch (error) {
        console.error('Error deleting policy:', error);
        this.toast.show('Failed to delete policy', 'error');
      }
    }
  }
  // --- Claims Logic ---
  isClaimsModalOpen = false;
  isLoadingClaims = false;
  claimsList: any[] = [];
  paginatedClaims: any[] = [];
  claimsPage = 1;
  claimsPageSize = 10;
  totalClaims = 0;

  openClaimsModal() {
    this.isClaimsModalOpen = true;
    this.isLoadingClaims = true;
    this.generateDummyClaims();

    // Simulate API delay
    setTimeout(() => {
      this.isLoadingClaims = false;
      this.updateClaimsPagination();
    }, 1500);
  }

  closeClaimsModal() {
    this.isClaimsModalOpen = false;
    this.claimsList = [];
    this.paginatedClaims = [];
    this.claimsPage = 1;
  }

  generateDummyClaims() {
    const statuses = ['Pending', 'Approved', 'Rejected', 'In Review'];
    this.claimsList = Array.from({ length: 30 }, (_, i) => ({
      id: `CLM-${1000 + i}`,
      policyName: `Policy ${['A', 'B', 'C'][Math.floor(Math.random() * 3)]} - ${100 + i}`,
      claimant: `User ${i + 1}`,
      dateSubmitted: new Date(2025, 0, i + 1),
      amount: Math.floor(Math.random() * 5000) + 500,
      status: statuses[Math.floor(Math.random() * statuses.length)]
    }));
    this.totalClaims = this.claimsList.length;
  }

  updateClaimsPagination() {
    const startIndex = (this.claimsPage - 1) * this.claimsPageSize;
    const endIndex = startIndex + this.claimsPageSize;
    this.paginatedClaims = this.claimsList.slice(startIndex, endIndex);
  }

  nextClaimsPage() {
    if ((this.claimsPage * this.claimsPageSize) < this.totalClaims) {
      this.claimsPage++;
      this.updateClaimsPagination();
    }
  }

  prevClaimsPage() {
    if (this.claimsPage > 1) {
      this.claimsPage--;
      this.updateClaimsPagination();
    }
  }


  get totalClaimsPages(): number {
    return Math.ceil(this.totalClaims / this.claimsPageSize);
  }

  // --- Renewals Methods ---

  openRenewalsModal() {
    this.isRenewalsModalOpen = true;
    this.isLoadingRenewals = true;
    this.generateDummyRenewals();

    setTimeout(() => {
      this.isLoadingRenewals = false;
      this.filterRenewals();
    }, 1500);
  }

  closeRenewalsModal() {
    this.isRenewalsModalOpen = false;
    this.allRenewals = [];
    this.filteredRenewals = [];
    this.paginatedRenewals = [];
    this.renewalPage = 1;
    this.renewalSearchControl.setValue('', { emitEvent: false });
  }

  setRenewalFilter(type: 'insurance' | 'radio') {
    this.renewalFilterType = type;
    this.renewalPage = 1;
    this.filterRenewals();
  }

  generateDummyRenewals() {
    // Generate 50 dummy items mixed
    const statuses = ['Pending Payment', 'Overdue', 'Due Soon'];
    this.allRenewals = Array.from({ length: 50 }, (_, i) => {
      const isInsurance = i % 2 === 0;
      return {
        id: `REN-${2000 + i}`,
        type: isInsurance ? 'insurance' : 'radio',
        entityName: isInsurance ? `Policy - Honda Clean ${i}` : `Radio Lic - Station ${i}`,
        description: isInsurance ? 'Comprehensive Cover' : 'Broadcasting License 2025',
        expiryDate: new Date(2025, 3, (i % 30) + 1),
        amount: isInsurance ? 1200 : 5000,
        status: statuses[Math.floor(Math.random() * statuses.length)]
      };
    });
  }

  filterRenewals() {
    const term = (this.renewalSearchControl.value || '').toLowerCase();

    this.filteredRenewals = this.allRenewals.filter(item => {
      const matchesType = item.type === this.renewalFilterType;
      const matchesSearch = item.entityName.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term);
      return matchesType && matchesSearch;
    });

    this.totalRenewalPages = Math.ceil(this.filteredRenewals.length / this.renewalPageSize);
    this.renewalPage = 1;
    this.updateRenewalPagination();
  }

  updateRenewalPagination() {
    const startIndex = (this.renewalPage - 1) * this.renewalPageSize;
    const endIndex = startIndex + this.renewalPageSize;
    this.paginatedRenewals = this.filteredRenewals.slice(startIndex, endIndex);
  }

  nextRenewalPage() {
    if (this.renewalPage < this.totalRenewalPages) {
      this.renewalPage++;
      this.updateRenewalPagination();
    }
  }

  prevRenewalPage() {
    if (this.renewalPage > 1) {
      this.renewalPage--;
      this.updateRenewalPagination();
    }
  }

  // --- Accordion Logic ---
  isPoliciesExpanded = true;
  isClaimsExpanded = false;

  // --- Dashboard Claims Logic ---
  dashboardClaimsList: any[] = [];
  paginatedDashboardClaims: any[] = [];
  dashboardClaimsPage = 1;
  dashboardClaimsPageSize = 10;
  totalDashboardClaimsPages = 0;
  dashboardClaimsIsLoading = false;
  dashboardClaimsSearchControl = new FormControl('');

  togglePoliciesAccordion() {
    this.isPoliciesExpanded = !this.isPoliciesExpanded;
  }

  toggleClaimsAccordion() {
    this.isClaimsExpanded = !this.isClaimsExpanded;
    if (this.isClaimsExpanded && this.dashboardClaimsList.length === 0) {
      this.loadDashboardClaims();
    }
  }

  loadDashboardClaims() {
    this.dashboardClaimsIsLoading = true;
    setTimeout(() => {
      // Generate persistent dummy data for dashboard
      this.dashboardClaimsList = Array.from({ length: 45 }, (_, i) => ({
        id: `D-CLM-${3000 + i}`,
        policyName: `Policy - ${['Fire', 'Home', 'Motor'][i % 3]} Protection`,
        claimant: `Client ${i + 100}`,
        dateSubmitted: new Date(2025, 1, (i % 28) + 1),
        amount: Math.floor(Math.random() * 8000) + 1000,
        status: ['Pending', 'Approved', 'Rejected'][Math.floor(Math.random() * 3)]
      }));
      this.totalDashboardClaimsPages = Math.ceil(this.dashboardClaimsList.length / this.dashboardClaimsPageSize);
      this.updateDashboardClaimsPagination();
      this.dashboardClaimsIsLoading = false;
    }, 1000);
  }

  updateDashboardClaimsPagination() {
    const startIndex = (this.dashboardClaimsPage - 1) * this.dashboardClaimsPageSize;
    const endIndex = startIndex + this.dashboardClaimsPageSize;
    const term = (this.dashboardClaimsSearchControl.value || '').toLowerCase();

    let filtered = this.dashboardClaimsList;
    if (term) {
      filtered = this.dashboardClaimsList.filter(c =>
        c.policyName.toLowerCase().includes(term) ||
        c.claimant.toLowerCase().includes(term)
      );
    }

    this.totalDashboardClaimsPages = Math.ceil(filtered.length / this.dashboardClaimsPageSize);
    this.paginatedDashboardClaims = filtered.slice(startIndex, endIndex);
  }

  nextDashboardClaimsPage() {
    if (this.dashboardClaimsPage < this.totalDashboardClaimsPages) {
      this.dashboardClaimsPage++;
      this.updateDashboardClaimsPagination();
    }
  }

  prevDashboardClaimsPage() {
    if (this.dashboardClaimsPage > 1) {
      this.dashboardClaimsPage--;
      this.updateDashboardClaimsPagination();
    }
  }
}

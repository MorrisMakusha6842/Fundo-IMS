import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { PolicyService } from '../services/policy.service';
import { ToastService } from '../services/toast.service';
import { Observable, tap, combineLatest, map, startWith } from 'rxjs';

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
      coverages: ['', Validators.required] // Simple text area for comma-separated values
    });
    this.packages.push(pkgGroup);
  }

  removePackage(index: number) {
    this.packages.removeAt(index);
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
    if (this.createPolicyForm.invalid) return;
    this.isSubmitting = true;
    const { subCategory, policyName, packages } = this.createPolicyForm.value;

    // Find the name of the selected sub-category to store on the policy for easier display
    const selectedSub = this.subCategoriesList.find(s => s.id === subCategory);
    const subCategoryName = selectedSub ? selectedSub.name : 'Unknown';

    // Process packages to split coverages string into array
    const processedPackages = packages.map((pkg: any) => ({
      name: pkg.name,
      coverages: (pkg.coverages || '').split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
    }));

    try {
      // subCategory is the ID of the selected category
      await this.policyService.addPolicy(subCategory, {
        policyName,
        packages: processedPackages,
        subCategoryId: subCategory,
        subCategoryName: subCategoryName,
        createdAt: new Date(),
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
}

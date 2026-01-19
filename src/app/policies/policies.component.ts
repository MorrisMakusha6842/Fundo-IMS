import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { PolicyService } from '../services/policy.service';
import { Observable, tap } from 'rxjs';

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
  isSubmitting = false;
  isLoading = true;

  // Data
  subCategories$: Observable<any[]>;
  policies$: Observable<any[]>;
  private subCategoriesList: any[] = [];

  // Forms
  subCategoryForm: FormGroup;
  createPolicyForm: FormGroup;

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
    this.policies$ = this.policyService.getAllPolicies().pipe(
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
      this.closeSubCategoryModal();
    } catch (error) {
      console.error('Error creating sub category:', error);
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
      coverages: pkg.coverages.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
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
      this.closeCreatePolicyModal();
    } catch (error) {
      console.error('Error creating policy:', error);
    } finally {
      this.isSubmitting = false;
    }
  }
}

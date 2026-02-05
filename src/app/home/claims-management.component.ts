import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ClaimsService, ClaimData } from '../services/claims.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-claims-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './claims-management.component.html',
  styleUrl: './claims-management.component.scss'
})
export class ClaimsManagementComponent implements OnInit {
  private claimsService = inject(ClaimsService);
  private toast = inject(ToastService);

  claims: ClaimData[] = [];
  filteredClaims: ClaimData[] = [];
  searchControl = new FormControl('');
  isLoading = false;

  // Pagination
  currentPage = 1;
  pageSize = 25;

  ngOnInit() {
    this.fetchClaims();
    this.searchControl.valueChanges.subscribe(val => this.filterClaims(val));
  }

  fetchClaims() {
    this.isLoading = true;
    this.claimsService.getAllClaims().subscribe({
      next: (data) => {
        this.claims = data;
        this.filterClaims(this.searchControl.value);
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.toast.show('Failed to load claims', 'error');
        this.isLoading = false;
      }
    });
  }

  filterClaims(term: string | null) {
    this.currentPage = 1;
    const lowerTerm = (term || '').toLowerCase();
    this.filteredClaims = this.claims.filter(c =>
      (c.claimId || '').toLowerCase().includes(lowerTerm) ||
      (c.policyName || '').toLowerCase().includes(lowerTerm) ||
      (c.displayName || '').toLowerCase().includes(lowerTerm) ||
      (c.assetDescription || '').toLowerCase().includes(lowerTerm)
    );
  }

  get totalPages(): number {
    return Math.ceil(this.filteredClaims.length / this.pageSize);
  }

  get paginatedClaims(): any[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredClaims.slice(startIndex, startIndex + this.pageSize);
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  viewClaim(claim: any) {
    console.log('View claim details', claim);
    // Future implementation: Open modal with claim details
  }
}
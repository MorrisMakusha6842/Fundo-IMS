import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, HostBinding, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PolicyService } from '../services/policy.service';
import { AssetsService, VehicleAsset } from '../services/assets.service';
import { AuthService } from '../services/auth.service';
import { of, switchMap, forkJoin } from 'rxjs';

@Component({
  selector: 'app-policy-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './policy-detail-modal.component.html',
  styleUrls: ['./policy-detail-modal.component.scss']
})
export class PolicyDetailModalComponent implements OnChanges {
  @Input() policy: any | null = null;
  @Output() close = new EventEmitter<void>();

  @HostBinding('class.visible')
  get isVisible(): boolean {
    return !!this.policy;
  }

  private policyService = inject(PolicyService);
  private assetsService = inject(AssetsService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;
  packages: any[] = [];
  availableAssets: VehicleAsset[] = [];
  
  // Quote Form State
  isQuoteAccordionOpen = false;
  selectedAssetId: string | null = null;
  paymentFrequency: 'monthly' | 'annually' = 'monthly';
  quotePremium = 0;
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['policy'] && this.policy) {
      this.fetchDataForPolicy(this.policy.id);
      document.body.style.overflow = 'hidden';
    } else if (!this.policy) {
      document.body.style.overflow = '';
    }
  }

  fetchDataForPolicy(policyId: string): void {
    this.isLoading = true;
    this.packages = [];
    this.availableAssets = [];
    this.resetQuoteForm();

    const packages$ = this.policyService.getPolicyPackages(policyId);
    const assets$ = this.authService.user$.pipe(
      switchMap(user => user ? this.assetsService.getUserVehicles(user.uid) : of([]))
    );

    forkJoin({ packages: packages$, assets: assets$ }).subscribe({
      next: ({ packages, assets }) => {
        this.packages = packages.length > 0 ? packages : this.getFallbackPackages();
        this.availableAssets = assets;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Error fetching policy details", err);
        this.packages = this.getFallbackPackages(); // Show fallback on error
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  onAssetChange(assetId: string | null): void {
    if (assetId) {
      const selected = this.availableAssets.find(a => a.id === assetId);
      if (selected) {
        const rawValue = String(selected.assetValue).replace(/[^0-9.]/g, '');
        const value = parseFloat(rawValue);
        this.quotePremium = !isNaN(value) ? value * 0.04 : 0; // 4% of Asset Value
      }
    } else {
      this.quotePremium = 0;
    }
  }

  saveQuote(): void {
    // TODO: Implement Firestore write to 'quotes' collection
    console.log('Saving quote...', {
      policyId: this.policy.id,
      assetId: this.selectedAssetId,
      premium: this.quotePremium,
      frequency: this.paymentFrequency
    });
    alert('Quote saved (see console for data).');
  }

  purchasePackage(): void {
    // TODO: Implement payment gateway logic
    console.log('Purchasing package...');
    alert('Purchase initiated (see console for data).');
  }

  closeModal(): void {
    this.close.emit();
  }

  private resetQuoteForm(): void {
    this.isQuoteAccordionOpen = false;
    this.selectedAssetId = null;
    this.paymentFrequency = 'monthly';
    this.quotePremium = 0;
  }

  private getFallbackPackages(): any[] {
    return [
      { id: 'pkg1', name: 'Standard', price: 50, description: 'Essential coverage for peace of mind.', coverages: [{ name: 'Third Party Liability', price: 0, included: true }, { name: 'Fire Protection', price: 10, included: false }] },
      { id: 'pkg2', name: 'Premium', price: 120, description: 'Complete protection for your asset.', coverages: [{ name: 'Third Party Liability', price: 0, included: true }, { name: 'Fire & Theft', price: 0, included: true }, { name: 'Accident Forgiveness', price: 25, included: false }] }
    ];
  }
}
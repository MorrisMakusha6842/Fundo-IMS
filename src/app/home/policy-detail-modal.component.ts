import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, OnInit, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssetsService, VehicleAsset } from '../services/assets.service';
import { AuthService } from '../services/auth.service';

@Component({
    selector: 'app-policy-detail-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './policy-detail-modal.component.html',
    styleUrls: ['./policy-detail-modal.component.scss']
})
export class PolicyDetailModalComponent implements OnInit, OnChanges {
    @Input() policy: any = null;
    @Output() close = new EventEmitter<void>();

    @HostBinding('class.visible')
    get isVisible(): boolean {
        return !!this.policy;
    }

    private assetsService = inject(AssetsService);
    private authService = inject(AuthService);

    isLoading = false;
    packages: any[] = [];
    availableAssets: VehicleAsset[] = [];

    // Quote Form State
    isQuoteAccordionOpen = false;
    selectedPackageId: string | null = null;
    selectedAssetId: string | null = null;
    paymentFrequency: 'monthly' | 'annually' = 'monthly';

    // Pricing
    basePackagePrice = 0;
    selectedOptionalCoverages = new Set<string>();
    quotePremium = 0;

    ngOnInit() {
        this.loadUserAssets();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['policy'] && this.policy) {
            this.mapPolicyPackages();
            this.resetQuoteForm();
        }
    }

    private mapPolicyPackages() {
        if (this.policy && Array.isArray(this.policy.packages)) {
            this.packages = this.policy.packages.map((pkg: any, index: number) => {
                let mappedCoverages: any[] = [];

                // Handle coverages array (strings or objects)
                if (Array.isArray(pkg.coverages)) {
                    mappedCoverages = pkg.coverages.map((cov: any) => {
                        if (typeof cov === 'string') {
                            return { name: cov, included: true, price: 0 };
                        }
                        return cov;
                    });
                }

                return {
                    id: pkg.id || `pkg-${index}`,
                    name: pkg.name || `Package ${index + 1}`,
                    price: pkg.price || 0,
                    description: pkg.description || '',
                    coverages: mappedCoverages
                };
            });
        } else {
            this.packages = [];
        }
    }

    loadUserAssets() {
        const user = this.authService.currentUser;
        if (user) {
            this.assetsService.getUserVehicles(user.uid).subscribe(assets => {
                this.availableAssets = assets;
            });
        }
    }

    selectPackage(pkg: any) {
        if (this.selectedPackageId === pkg.id) {
            this.selectedPackageId = null; // Collapse
            this.basePackagePrice = 0;
            this.quotePremium = 0;
            return;
        }

        this.selectedPackageId = pkg.id;
        this.basePackagePrice = pkg.price || 0;
        this.selectedOptionalCoverages.clear();
        this.calculatePremium();
    }

    toggleOptionalCoverage(cov: any) {
        if (this.selectedOptionalCoverages.has(cov.name)) {
            this.selectedOptionalCoverages.delete(cov.name);
        } else {
            this.selectedOptionalCoverages.add(cov.name);
        }
        this.calculatePremium();
    }

    isCoverageSelected(name: string): boolean {
        return this.selectedOptionalCoverages.has(name);
    }

    onAssetChange(assetId: any) {
        this.calculatePremium();
    }

    calculatePremium() {
        let total = this.basePackagePrice;

        // Add optional coverages
        this.selectedOptionalCoverages.forEach(name => {
            const pkg = this.packages.find(p => p.id === this.selectedPackageId);
            if (pkg) {
                const cov = pkg.coverages.find((c: any) => c.name === name);
                if (cov && cov.price) {
                    total += cov.price;
                }
            }
        });

        // Asset value factor
        if (this.selectedAssetId) {
            const asset = this.availableAssets.find(a => a.id === this.selectedAssetId);
            if (asset && asset.assetValue) {
                const value = parseFloat(asset.assetValue);
                if (!isNaN(value)) {
                    // Example calculation
                    const annualBase = value * 0.05;
                    if (this.paymentFrequency === 'monthly') {
                        total += (annualBase / 12);
                    } else {
                        total += annualBase;
                    }
                }
            }
        }

        this.quotePremium = total;
    }

    saveQuote() {
        alert('Quote saved successfully!');
    }

    purchasePackage() {
        alert('Purchase initiated.');
    }

    closeModal() {
        this.close.emit();
    }

    private resetQuoteForm() {
        this.isQuoteAccordionOpen = false;
        this.selectedAssetId = null;
        this.selectedPackageId = null;
        this.basePackagePrice = 0;
        this.selectedOptionalCoverages.clear();
        this.paymentFrequency = 'monthly';
        this.quotePremium = 0;
    }
}
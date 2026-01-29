import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject, OnInit, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssetsService, VehicleAsset } from '../services/assets.service';
import { AuthService } from '../services/auth.service';
import { FinancialInsightService } from '../financial-insight/financial-insight.service';

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
    private financialService = inject(FinancialInsightService);

    isLoading = false;
    packages: any[] = [];
    availableAssets: VehicleAsset[] = [];

    // Quote Form State
    isQuoteAccordionOpen = false;
    selectedPackageId: string | null = null;
    selectedAssetId: string | null = null;
    paymentFrequency: 'monthly' | 'annually' = 'monthly';

    quotePremium = 0;

    // Financial Data
    currentTaxRate = 0;
    currentFxRate = 0;

    get isRenewalPolicy(): boolean {
        return (this.policy?.policyType || '').toLowerCase() === 'renewal';
    }

    ngOnInit() {
        this.loadUserAssets();
        this.loadFinancialData();
    }

    async loadFinancialData() {
        try {
            const record = await this.financialService.getLatestRecord();
            if (record) {
                this.currentTaxRate = record.currentTaxRate || 0;
                this.currentFxRate = record.currentFxRate || 0;
                this.calculatePremium(); // Recalculate if data comes in late
            }
        } catch (error) {
            console.error('Error fetching financial data:', error);
        }
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
                        // Handle objects: assume included by default if not specified
                        // If it has an amount, treat it as price/fee
                        return {
                            name: cov.name,
                            included: true,
                            price: cov.amount || 0,
                            percentage: cov.percentage
                        };
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

    selectPackage(pkgId: string) {
        if (this.selectedPackageId === pkgId) {
            // If already selected, maybe just keep it selected? 
            // Or allow deselect? User said "selection feature" for coverages not needed, 
            // but for packages it is.
            return;
        }

        this.selectedPackageId = pkgId;
        this.calculatePremium();
    }

    // Optional coverages removed as requested

    onAssetChange(assetId: any) {
        this.calculatePremium();
    }

    calculatePremium() {
        let total = 0;
        let assuredValue = 0;
        const isRenewal = this.isRenewalPolicy;

        // 1. Get Assured Value from selected asset
        if (this.selectedAssetId) {
            const asset = this.availableAssets.find(a => a.id === this.selectedAssetId);
            if (asset && asset.assetValue) {
                const val = parseFloat(asset.assetValue);
                if (!isNaN(val)) {
                    assuredValue = val;
                }
            }
        } else {
            // If no asset selected, we can't calculate meaningful premium yet
            this.quotePremium = 0;
            return;
        }

        // For renewals, the asset value is ignored for calculation
        if (isRenewal) {
            assuredValue = 0;
        }

        // Base Premium starts with the Assured Value itself (per specific request)
        // Only add assuredValue to total if it is NOT a renewal policy
        if (!isRenewal) {
            total += assuredValue;
        }

        const pkg = this.packages.find(p => p.id === this.selectedPackageId);
        if (pkg) {
            // Add base package price if it exists
            if (pkg.price) {
                total += pkg.price;
            }

            // 2. Add Package Coverages (all are now considered included)
            pkg.coverages.forEach((cov: any) => {
                // Percentage based (of Assured Value)
                if (cov.percentage) {
                    total += (cov.percentage / 100) * assuredValue;
                }
                // Fixed Amount
                if (cov.price) {
                    total += cov.price;
                }
            });
        }

        // 3. Add Tax (Percentage of Assured Value)
        if (this.currentTaxRate > 0) {
            total += (this.currentTaxRate / 100) * assuredValue;
        }

        // 4. Add FX Rate for Renewals
        if (isRenewal) {
            // Apply Tax Rate as a percentage of the total premium (Package Cost)
            console.log(`Applying Tax Rate: ${this.currentTaxRate}% to Base: ${total}`);
            total += total * (this.currentTaxRate / 100);
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
        this.paymentFrequency = 'monthly';
        this.quotePremium = 0;
    }
}
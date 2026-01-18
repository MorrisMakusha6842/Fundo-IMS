import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-asset-registry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './asset-registry.component.html',
  styleUrl: './asset-registry.component.scss'
})
export class AssetRegistryComponent implements OnInit {
  private fb = inject(FormBuilder);

  assets: any[] = [
    {
      status: 'active',
      assetName: '2023 Ford Ranger',
      type: 'Vehicle',
      clientName: 'John Doe',
      policies: [
        { policyId: 'POL-123', policyType: 'Comprehensive', sumAssured: 45000, tenureMonths: 12, status: 'active' }
      ]
    },
    {
      status: 'pending',
      assetName: 'Headquarters',
      type: 'Property',
      clientName: 'Acme Corp',
      policies: []
    }
  ];

  selectedAsset: any = null;
  isAddAssetModalOpen = false;
  addAssetForm!: FormGroup;

  ngOnInit() {
    this.addAssetForm = this.fb.group({
      assetName: ['', Validators.required],
      type: ['Vehicle', Validators.required],
      clientName: ['', Validators.required],
      status: ['active', Validators.required]
    });
  }

  openAddAssetModal() {
    this.isAddAssetModalOpen = true;
    this.addAssetForm.reset({ type: 'Vehicle', status: 'active' });
  }

  closeAddAssetModal() {
    this.isAddAssetModalOpen = false;
  }

  onAddAsset() {
    if (this.addAssetForm.invalid) return;

    const newAsset = {
      ...this.addAssetForm.value,
      policies: []
    };

    this.assets.unshift(newAsset);
    this.closeAddAssetModal();
  }

  openCoverageModal(asset: any) {
    this.selectedAsset = asset;
  }

  closeCoverageModal() {
    this.selectedAsset = null;
  }
}

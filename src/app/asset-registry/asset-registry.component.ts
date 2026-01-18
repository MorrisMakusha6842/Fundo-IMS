
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { serverTimestamp } from '@angular/fire/firestore';
import { AssetsService, VehicleAsset } from '../services/assets.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-asset-registry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './asset-registry.component.html',
  styleUrls: ['./asset-registry.component.scss']
})
export class AssetRegistryComponent implements OnInit {
  assets: any[] = [];
  selectedAsset: any = null;
  isAddAssetModalOpen = false;
  isViewModalOpen = false;
  isSubmitting = false;

  private fb = inject(FormBuilder);
  private assetsService = inject(AssetsService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  // Main form containing an array of vehicles
  addAssetForm: FormGroup = this.fb.group({
    vehicles: this.fb.array([])
  });

  ngOnInit(): void {
    this.fetchAssets();
    // Initialize with one vehicle form
    this.addVehicle();
  }

  async fetchAssets() {
    try {
      const vehicles = await this.assetsService.getAllVehicles();
      // Map to display format if needed, or just assign
      this.assets = vehicles.map(v => ({
        ...v,
        assetName: `${v.year} ${v.make}`,
        type: 'Vehicle',
        clientName: 'Self', // Or fetch user details if needed
        status: 'Active' // Default status
      }));
    } catch (error) {
      console.error('Error fetching assets', error);
      this.toast.show('Failed to load assets', 'error');
    }
  }

  openAddAssetModal() {
    this.isAddAssetModalOpen = true;
  }

  closeAddAssetModal() {
    this.isAddAssetModalOpen = false;
    this.addAssetForm.reset();
    this.vehicles.clear();
    this.addVehicle(); // Reset to one empty form
  }

  get vehicles(): FormArray {
    return this.addAssetForm.get('vehicles') as FormArray;
  }

  createVehicleGroup(): FormGroup {
    return this.fb.group({
      // Basic Information
      make: ['', Validators.required],
      manufactureDate: ['', Validators.required], // Replaces year input
      numberPlate: ['', Validators.required],
      vin: ['', Validators.required],
      bodyType: ['', Validators.required],
      vehicleClass: ['', Validators.required],
      primaryUse: ['', Validators.required],
      garagingAddress: ['', Validators.required],
      safetyFeatures: ['', Validators.required],

      // Compliance & Documents
      assetValue: ['', Validators.required],
      policyDeploymentDate: [''],
      policyExpiryDate: [''],

      // File placeholders (we store the base64 string here)
      vehicleRegistrationBook: [null],
      radioLicense: [null],
      driversLicense: [null],
      insurancePolicy: [null],
      vehicleDocumentation: [null]
    });
  }

  addVehicle() {
    this.vehicles.push(this.createVehicleGroup());
  }

  removeVehicle(index: number) {
    this.vehicles.removeAt(index);
  }

  // Helper to handle file input changes
  async onFileChange(event: any, index: number, controlName: string) {
    const file = event.target.files[0];
    if (file) {
      try {
        const dataUrl = await this.fileToDataUrl(file);
        // Patch the specific control in the specific form group
        this.vehicles.at(index).patchValue({
          [controlName]: {
            name: file.name,
            type: file.type,
            dataUrl: dataUrl
          }
        });
      } catch (e) {
        console.error('File read error', e);
        this.toast.show('Error reading file', 'error');
      }
    }
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  async onAddAsset() {
    if (this.addAssetForm.invalid) {
      this.addAssetForm.markAllAsTouched();
      return;
    }

    const user = this.authService.currentUser;
    if (!user) {
      this.toast.show('You must be logged in to add assets.', 'error');
      return;
    }

    this.isSubmitting = true;

    try {
      const vehiclesData = this.addAssetForm.value.vehicles;

      for (const v of vehiclesData) {
        // Collect documents into an array
        const docs = [];
        if (v.vehicleRegistrationBook) {
          docs.push({
            name: v.vehicleRegistrationBook.name,
            type: v.vehicleRegistrationBook.type,
            dataUrl: v.vehicleRegistrationBook.dataUrl,
            field: 'Vehicle Registration Book'
          });
        }
        if (v.radioLicense) {
          docs.push({
            name: v.radioLicense.name,
            type: v.radioLicense.type,
            dataUrl: v.radioLicense.dataUrl,
            field: 'Radio License'
          });
        }
        if (v.driversLicense) {
          docs.push({
            name: v.driversLicense.name,
            type: v.driversLicense.type,
            dataUrl: v.driversLicense.dataUrl,
            field: 'Drivers License'
          });
        }
        if (v.insurancePolicy) {
          docs.push({
            name: v.insurancePolicy.name,
            type: v.insurancePolicy.type,
            dataUrl: v.insurancePolicy.dataUrl,
            field: 'Insurance Policy'
          });
        }
        if (v.vehicleDocumentation) {
          docs.push({
            name: v.vehicleDocumentation.name,
            type: v.vehicleDocumentation.type,
            dataUrl: v.vehicleDocumentation.dataUrl,
            field: 'Vehicle Documentation'
          });
        }

        const year = v.manufactureDate ? new Date(v.manufactureDate).getFullYear() : new Date().getFullYear();

        const newAsset: VehicleAsset = {
          garagingAddress: v.garagingAddress,
          make: v.make,
          numberPlate: v.numberPlate,
          primaryUse: v.primaryUse,
          uid: user.uid,
          userId: user.uid,
          vehicleClass: v.vehicleClass,
          vin: v.vin,
          year: isNaN(year) ? new Date().getFullYear() : year,
          bodyType: v.bodyType,
          createdAt: serverTimestamp(),
          assetValue: String(v.assetValue),
          safetyFeatures: v.safetyFeatures,
          policyDeploymentDate: v.policyDeploymentDate,
          policyExpiryDate: v.policyExpiryDate,
          documents: docs,
          status: 'Pending'
        };

        await this.assetsService.addVehicleAsset(newAsset);

        // Optimistic update for UI
        this.assets.unshift({
          ...newAsset,
          assetName: `${newAsset.year} ${newAsset.make}`,
          type: 'Vehicle',
          status: 'Pending'
        });
      }

      this.toast.show('Assets added successfully', 'success');
      this.closeAddAssetModal();
    } catch (error) {
      console.error('Error adding asset', error);
      this.toast.show('Failed to add asset', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  openViewModal(asset: any) {
    this.selectedAsset = asset;
    this.isViewModalOpen = true;
  }

  closeViewModal() {
    this.selectedAsset = null;
    this.isViewModalOpen = false;
  }

  async onDeleteAsset(asset: any) {
    if (confirm(`Are you sure you want to delete ${asset.assetName}?`)) {
      try {
        // We need the owner's UID (asset.uid) and the vehicle ID (asset.id)
        await this.assetsService.deleteVehicle(asset.uid, asset.id);
        this.assets = this.assets.filter(a => a.id !== asset.id);
        this.toast.show('Asset deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting asset', error);
        this.toast.show('Failed to delete asset', 'error');
      }
    }
  }
}

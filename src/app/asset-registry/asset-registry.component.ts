
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { serverTimestamp, Bytes } from '@angular/fire/firestore';
import { AssetsService, VehicleAsset } from '../services/assets.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { UserService } from '../services/user.service';
import { Subscription, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-asset-registry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './asset-registry.component.html',
  styleUrls: ['./asset-registry.component.scss']
})
export class AssetRegistryComponent implements OnInit, OnDestroy {
  assets: any[] = [];
  selectedAsset: any = null;
  isAddAssetModalOpen = false;
  isViewModalOpen = false;
  isSubmitting = false;
  isLoading = true;

  // Approval workflow
  isApprovalModalOpen = false;
  assuredValue: number = 0;
  pendingApprovalAsset: any = null;

  private fb = inject(FormBuilder);
  private assetsService = inject(AssetsService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private userService = inject(UserService);
  private assetsSubscription?: Subscription;

  // Main form containing an array of vehicles
  addAssetForm: FormGroup = this.fb.group({
    vehicles: this.fb.array([])
  });

  // Form for editing an existing asset
  editAssetForm: FormGroup = this.fb.group({
    assetValue: ['', Validators.required],
    safetyFeatures: [''],
    policyDeploymentDate: [''],
    policyExpiryDate: [''],
    vehicleRegistrationBook: [null],
    radioLicense: [null],
    driversLicense: [null],
    insurancePolicy: [null],
    vehicleDocumentation: [null]
  });

  ngOnInit(): void {
    this.fetchAssets();
    // Initialize with one vehicle form
    this.addVehicle();
  }

  ngOnDestroy(): void {
    if (this.assetsSubscription) {
      this.assetsSubscription.unsubscribe();
    }
  }

  fetchAssets() {
    this.isLoading = true;

    // Switch stream based on role: Admin/Agent gets all, Client gets their own
    this.assetsSubscription = this.authService.userRole$.pipe(
      switchMap(role => {
        if (role === 'admin' || role === 'agent') {
          return this.assetsService.getAllVehicles();
        }
        const user = this.authService.currentUser;
        return user ? this.assetsService.getUserVehicles(user.uid) : of([]);
      })
    ).subscribe({
      next: async (vehicles) => {
        const userCache = new Map<string, string>();

        // Process vehicles (async mapping for user profiles)
        this.assets = await Promise.all(vehicles.map(async (v: any) => {
          // Convert stored binary Bytes back to Base64 Data URL for display
          const displayDocuments = v.documents?.map((doc: any) => {
            if (doc.storageData && typeof doc.storageData.toBase64 === 'function') {
              return { ...doc, dataUrl: `data:${doc.type};base64,${doc.storageData.toBase64()}` };
            }
            return doc;
          });

          let clientName = 'Unknown';
          const ownerId = v.uid || v.userId;
          if (ownerId) {
            if (userCache.has(ownerId)) {
              clientName = userCache.get(ownerId)!;
            } else {
              try {
                const userDoc = await this.userService.getUserProfile(ownerId);
                if (userDoc) {
                  clientName = userDoc['displayName'] || userDoc['email'] || 'Unknown';
                }
                userCache.set(ownerId, clientName);
              } catch (e) {
                console.warn('Error fetching user profile', e);
              }
            }
          }

          return {
            ...v,
            documents: displayDocuments,
            assetName: `${v.year} ${v.make}`,
            type: 'Vehicle',
            clientName: clientName,
            status: v.status || 'Active'
          }
        }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching assets', error);
        this.toast.show('Failed to load assets', 'error');
        this.isLoading = false;
      }
    });
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
        // Process file: Compress if image, check size if other
        const processed = await this.processFile(file);

        // Patch the specific control in the specific form group
        this.vehicles.at(index).patchValue({
          [controlName]: {
            name: file.name,
            type: processed.type,
            storageData: processed.storageData
          }
        });
      } catch (e: any) {
        console.error('File read error', e);
        this.toast.show(e.message || 'Error reading file', 'error');
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

  private async processFile(file: File): Promise<{ type: string, storageData: Bytes }> {
    let dataUrl: string;

    // 1. Compress if image
    if (file.type.startsWith('image/')) {
      dataUrl = await this.compressImage(file);
    } else {
      // Non-images: check size
      if (file.size > 250 * 1024) {
        throw new Error(`File ${file.name} is too large (>250KB). Please use an image or a smaller file.`);
      }
      dataUrl = await this.fileToDataUrl(file);
    }

    // 2. Convert Base64 DataURL to Firestore Bytes (Binary)
    // This removes the 33% Base64 overhead for storage
    const bytes = this.dataURItoBytes(dataUrl);

    return { type: file.type, storageData: bytes };
  }

  private dataURItoBytes(dataURI: string): Bytes {
    // data:image/jpeg;base64,.....
    const base64 = dataURI.split(',')[1];
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return Bytes.fromUint8Array(byteArray);
  }

  private compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event: any) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          const MAX_HEIGHT = 1024;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.6 quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
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
            storageData: v.vehicleRegistrationBook.storageData,
            field: 'Vehicle Registration Book',
            uploadedAt: new Date().toISOString()
          });
        }
        if (v.radioLicense) {
          docs.push({
            name: v.radioLicense.name,
            type: v.radioLicense.type,
            storageData: v.radioLicense.storageData,
            field: 'Radio License',
            uploadedAt: new Date().toISOString()
          });
        }
        if (v.driversLicense) {
          docs.push({
            name: v.driversLicense.name,
            type: v.driversLicense.type,
            storageData: v.driversLicense.storageData,
            field: 'Drivers License',
            uploadedAt: new Date().toISOString()
          });
        }
        if (v.insurancePolicy) {
          docs.push({
            name: v.insurancePolicy.name,
            type: v.insurancePolicy.type,
            storageData: v.insurancePolicy.storageData,
            field: 'Insurance Policy',
            uploadedAt: new Date().toISOString()
          });
        }
        if (v.vehicleDocumentation) {
          docs.push({
            name: v.vehicleDocumentation.name,
            type: v.vehicleDocumentation.type,
            storageData: v.vehicleDocumentation.storageData,
            field: 'Vehicle Documentation',
            uploadedAt: new Date().toISOString()
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

    // Patch the edit form with existing values
    this.editAssetForm.patchValue({
      assetValue: asset.assetValue,
      safetyFeatures: asset.safetyFeatures,
      policyDeploymentDate: asset.policyDeploymentDate,
      policyExpiryDate: asset.policyExpiryDate,
      vehicleRegistrationBook: null,
      radioLicense: null,
      driversLicense: null,
      insurancePolicy: null,
      vehicleDocumentation: null
    });
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

  // Approval workflow methods
  openApprovalModal(asset: any) {
    this.pendingApprovalAsset = asset;
    this.assuredValue = parseFloat(asset.assetValue) || 0;
    this.isApprovalModalOpen = true;
  }

  closeApprovalModal() {
    this.isApprovalModalOpen = false;
    this.pendingApprovalAsset = null;
    this.assuredValue = 0;
  }

  async onSendApproval() {
    if (!this.pendingApprovalAsset || this.assuredValue <= 0) {
      this.toast.show('Please enter a valid assured value', 'error');
      return;
    }

    try {
      await this.assetsService.approveAsset(
        this.pendingApprovalAsset.uid,
        this.pendingApprovalAsset.id,
        this.assuredValue
      );

      // Update local asset status
      const assetIndex = this.assets.findIndex(a => a.id === this.pendingApprovalAsset.id);
      if (assetIndex !== -1) {
        this.assets[assetIndex].status = 'Active';
        this.assets[assetIndex].assuredValue = this.assuredValue;
      }

      // Update selected asset if it's the same one
      if (this.selectedAsset?.id === this.pendingApprovalAsset.id) {
        this.selectedAsset.status = 'Active';
        this.selectedAsset.assuredValue = this.assuredValue;
      }

      this.toast.show('Asset approved successfully', 'success');
      this.closeApprovalModal();
    } catch (error) {
      console.error('Error approving asset', error);
      this.toast.show('Failed to approve asset', 'error');
    }
  }

  async onEditFileChange(event: any, controlName: string) {
    const file = event.target.files[0];
    if (file) {
      try {
        const processed = await this.processFile(file);
        this.editAssetForm.patchValue({
          [controlName]: {
            name: file.name,
            type: processed.type,
            storageData: processed.storageData
          }
        });
      } catch (e: any) {
        console.error('File read error', e);
        this.toast.show(e.message || 'Error reading file', 'error');
      }
    }
  }

  async onUpdateAsset() {
    if (this.editAssetForm.invalid) {
      this.editAssetForm.markAllAsTouched();
      this.toast.show('Please fill in all required fields', 'error');
      return;
    }

    if (!this.selectedAsset) return;

    this.isSubmitting = true;

    try {
      const formValues = this.editAssetForm.value;
      let updatedDocuments = [...(this.selectedAsset.documents || [])];

      const fileControls = [
        { key: 'vehicleRegistrationBook', field: 'Vehicle Registration Book' },
        { key: 'radioLicense', field: 'Radio License' },
        { key: 'driversLicense', field: 'Drivers License' },
        { key: 'insurancePolicy', field: 'Insurance Policy' },
        { key: 'vehicleDocumentation', field: 'Vehicle Documentation' }
      ];

      for (const fc of fileControls) {
        const newFile = formValues[fc.key];
        if (newFile) {
          updatedDocuments = updatedDocuments.filter(d => d.field !== fc.field);
          updatedDocuments.push({
            name: newFile.name,
            type: newFile.type,
            storageData: newFile.storageData,
            field: fc.field,
            uploadedAt: new Date().toISOString()
          });
        }
      }

      const docsForStorage = updatedDocuments.map(d => {
        const { dataUrl, ...rest } = d;
        return rest;
      });

      const updatedAsset: VehicleAsset = {
        garagingAddress: this.selectedAsset.garagingAddress,
        make: this.selectedAsset.make,
        numberPlate: this.selectedAsset.numberPlate,
        primaryUse: this.selectedAsset.primaryUse,
        uid: this.selectedAsset.uid,
        userId: this.selectedAsset.userId,
        vehicleClass: this.selectedAsset.vehicleClass,
        vin: this.selectedAsset.vin,
        year: this.selectedAsset.year,
        bodyType: this.selectedAsset.bodyType,
        createdAt: this.selectedAsset.createdAt,
        updatedAt: serverTimestamp(),
        status: this.selectedAsset.status,
        safetyFeatures: formValues.safetyFeatures,
        assetValue: String(formValues.assetValue),
        policyDeploymentDate: formValues.policyDeploymentDate,
        policyExpiryDate: formValues.policyExpiryDate,
        documents: docsForStorage
      };

      await this.assetsService.updateVehicleAsset(this.selectedAsset.id, updatedAsset);
      
      this.toast.show('Asset updated successfully', 'success');
      this.closeViewModal();
      this.fetchAssets();

    } catch (error) {
      console.error('Error updating asset', error);
      this.toast.show('Failed to update asset', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }
}

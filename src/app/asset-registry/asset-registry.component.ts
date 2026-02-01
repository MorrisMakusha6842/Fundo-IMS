
import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { serverTimestamp, Bytes } from '@angular/fire/firestore';
import { AssetsService, VehicleAsset } from '../services/assets.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { UserService } from '../services/user.service';
import { InvoiceService, Invoice } from '../services/invoice.service';
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
  private invoiceService = inject(InvoiceService);
  private assetsSubscription?: Subscription;

  // Camera State
  cameraModalOpen = false;
  mediaStream: MediaStream | null = null;
  tempImagePreview: string | null = null;
  tempFile: File | null = null;
  activeCameraContext: { mode: 'add' | 'edit', index?: number, controlName: string } | null = null;

  // ... (existing code)



  // Main form containing an array of vehicles
  addAssetForm: FormGroup = this.fb.group({
    vehicles: this.fb.array([])
  });

  // Form for editing an existing asset
  editAssetForm: FormGroup = this.fb.group({
    assetValue: ['', Validators.required],
    safetyFeatures: [''],
    vehicleRegistrationBook: [null],
    vehicleRegistrationBookExpiry: [''],
    radioLicense: [null],
    radioLicenseExpiry: [''],
    driversLicense: [null],
    driversLicenseExpiry: [''],
    insurancePolicy: [null],
    insurancePolicyExpiry: [''],
    vehicleDocumentation: [null],
    vehicleDocumentationExpiry: ['']
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
            storageData: processed.storageData,
            uploadedAt: new Date().toISOString()
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
            expiryDate: v.vehicleRegistrationBookExpiry || null,
            uploadedAt: v.vehicleRegistrationBook.uploadedAt || new Date().toISOString()
          });
        }
        if (v.radioLicense) {
          docs.push({
            name: v.radioLicense.name,
            type: v.radioLicense.type,
            storageData: v.radioLicense.storageData,
            field: 'Radio License',
            expiryDate: v.radioLicenseExpiry || null,
            uploadedAt: v.radioLicense.uploadedAt || new Date().toISOString()
          });
        }
        if (v.driversLicense) {
          docs.push({
            name: v.driversLicense.name,
            type: v.driversLicense.type,
            storageData: v.driversLicense.storageData,
            field: 'Drivers License',
            expiryDate: v.driversLicenseExpiry || null,
            uploadedAt: v.driversLicense.uploadedAt || new Date().toISOString()
          });
        }
        if (v.insurancePolicy) {
          docs.push({
            name: v.insurancePolicy.name,
            type: v.insurancePolicy.type,
            storageData: v.insurancePolicy.storageData,
            field: 'Insurance Policy',
            expiryDate: v.insurancePolicyExpiry || null,
            uploadedAt: v.insurancePolicy.uploadedAt || new Date().toISOString()
          });
        }
        if (v.vehicleDocumentation) {
          docs.push({
            name: v.vehicleDocumentation.name,
            type: v.vehicleDocumentation.type,
            storageData: v.vehicleDocumentation.storageData,
            field: 'Vehicle Documentation',
            expiryDate: v.vehicleDocumentationExpiry || null,
            uploadedAt: v.vehicleDocumentation.uploadedAt || new Date().toISOString()
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

    const getDocExpiry = (field: string) => {
      // Filter for all docs of this type and take the last one (most recent)
      const docs = asset.documents?.filter((d: any) => d.field === field);
      const doc = docs && docs.length > 0 ? docs[docs.length - 1] : null;
      return doc?.expiryDate || '';
    };

    // Patch the edit form with existing values
    this.editAssetForm.patchValue({
      assetValue: asset.assetValue,
      safetyFeatures: asset.safetyFeatures,
      vehicleRegistrationBookExpiry: getDocExpiry('Vehicle Registration Book'),
      radioLicenseExpiry: getDocExpiry('Radio License'),
      driversLicenseExpiry: getDocExpiry('Drivers License'),
      insurancePolicyExpiry: getDocExpiry('Insurance Policy'),
      vehicleDocumentationExpiry: getDocExpiry('Vehicle Documentation')
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

  // Expose user role for template
  userRole$ = this.authService.userRole$;

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

    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      this.toast.show('You must be logged in to approve assets', 'error');
      return;
    }

    this.isSubmitting = true;

    try {
      // 1. Approve Asset
      await this.assetsService.approveAsset(
        this.pendingApprovalAsset.uid,
        this.pendingApprovalAsset.id,
        this.assuredValue,
        currentUser.uid
      );

      // 2. Generate Invoice
      const invoiceData: Invoice = {
        assetId: this.pendingApprovalAsset.id,
        assetName: this.pendingApprovalAsset.assetName,
        clientId: this.pendingApprovalAsset.uid, // Owner ID
        clientName: this.pendingApprovalAsset.clientName || 'Unknown',
        amount: this.assuredValue,
        status: 'Unpaid',
        createdAt: serverTimestamp(),
        generatedBy: currentUser.uid,
        description: `Insurance premium for ${this.pendingApprovalAsset.assetName}`,
        invoiceType: 'proforma'
      };

      await this.invoiceService.createInvoice(invoiceData);

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

      this.toast.show('Asset approved and invoice generated', 'success');
      this.closeApprovalModal();
    } catch (error: any) {
      console.error('Error in approval workflow', error);
      if (error.code === 'permission-denied') {
        this.toast.show('Permission denied: Ensure your account has Admin/Agent rights.', 'error');
      } else {
        this.toast.show('Failed to complete approval workflow: ' + error.message, 'error');
      }
    } finally {
      this.isSubmitting = false;
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
            storageData: processed.storageData,
            uploadedAt: new Date().toISOString()
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
        { key: 'vehicleRegistrationBook', expiryKey: 'vehicleRegistrationBookExpiry', field: 'Vehicle Registration Book' },
        { key: 'radioLicense', expiryKey: 'radioLicenseExpiry', field: 'Radio License' },
        { key: 'driversLicense', expiryKey: 'driversLicenseExpiry', field: 'Drivers License' },
        { key: 'insurancePolicy', expiryKey: 'insurancePolicyExpiry', field: 'Insurance Policy' },
        { key: 'vehicleDocumentation', expiryKey: 'vehicleDocumentationExpiry', field: 'Vehicle Documentation' }
      ];

      for (const fc of fileControls) {
        const newFile = formValues[fc.key];
        const expiry = formValues[fc.expiryKey];

        if (newFile) {
          // Remove old doc of same type
          updatedDocuments = updatedDocuments.filter(d => d.field !== fc.field);
          // Add new doc
          updatedDocuments.push({
            name: newFile.name,
            type: newFile.type,
            storageData: newFile.storageData,
            field: fc.field,
            expiryDate: expiry || null,
            uploadedAt: newFile.uploadedAt || new Date().toISOString()
          });
        } else {
          // No new file, but check if expiry date changed for existing doc
          const existingDocIndex = updatedDocuments.findIndex(d => d.field === fc.field);
          if (existingDocIndex !== -1) {
            // Create a shallow copy of the doc to update expiry
            updatedDocuments[existingDocIndex] = {
              ...updatedDocuments[existingDocIndex],
              expiryDate: expiry || null
            };
          }
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

  // --- Camera Logic ---

  openCameraFor(mode: 'add' | 'edit', index: number | undefined, controlName: string) {
    this.activeCameraContext = { mode, index, controlName };
    this.cameraModalOpen = true;
    this.tempImagePreview = null;
    this.tempFile = null;
    setTimeout(() => this.startCamera(), 50);
  }

  async startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.toast.show('Camera not supported', 'error');
      return;
    }

    try {
      if (this.mediaStream) return;

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      
      setTimeout(async () => {
        const video: HTMLVideoElement | null = document.querySelector('#assetCameraModalVideo');
        if (video) {
          video.srcObject = this.mediaStream;
          await video.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      console.warn('Camera error', err);
      this.toast.show('Unable to access camera', 'error');
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    const video: HTMLVideoElement | null = document.querySelector('#assetCameraModalVideo');
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  async takePhoto() {
    const video: HTMLVideoElement | null = document.querySelector('#assetCameraModalVideo');
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: blob.type });
    
    this.tempImagePreview = dataUrl;
    this.tempFile = file;
  }

  retake() {
    this.tempImagePreview = null;
    this.tempFile = null;
  }

  async savePhoto() {
    if (!this.tempFile || !this.activeCameraContext) return;

    try {
      const processed = await this.processFile(this.tempFile);
      const fileData = {
        name: this.tempFile.name,
        type: processed.type,
        storageData: processed.storageData,
        uploadedAt: new Date().toISOString()
      };

      if (this.activeCameraContext.mode === 'add' && typeof this.activeCameraContext.index === 'number') {
        this.vehicles.at(this.activeCameraContext.index).patchValue({
          [this.activeCameraContext.controlName]: fileData
        });
      } else if (this.activeCameraContext.mode === 'edit') {
        this.editAssetForm.patchValue({
          [this.activeCameraContext.controlName]: fileData
        });
      }

      this.toast.show('Photo captured successfully', 'success');
    } catch (e: any) {
      this.toast.show('Error processing photo', 'error');
    }

    this.cameraModalOpen = false;
    this.stopCamera();
  }
}

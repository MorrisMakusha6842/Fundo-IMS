import { Component, EventEmitter, Output, Input, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { AssetsService } from '../services/assets.service';
import { ToastService } from '../services/toast.service';
import { serverTimestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-account-initialising',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './account-initialising.component.html',
  styleUrls: ['./account-initialising.component.scss']
})
export class AccountInitialisingComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Optional input to control visibility externally */
  @Input() open = true;
  @Input() isLoading = false;
  /** Emitted when the user closes the modal (completed or cancels) */
  @Output() close = new EventEmitter<void>();
  submitting = false;
  private _escHandler: any = null;
  @ViewChild('modalCard') modalCard!: ElementRef<HTMLElement>;

  form = this.fb.group({
    usaStatus: [null, Validators.required], // 'agreed' | 'disagreed'
    // vehicle details
    vehicleMake: ['', Validators.required],
    vehicleClass: [''],
    numberPlate: ['', Validators.required],
    year: [null],
    bodyType: [''],
    garagingAddress: [''],
    vin: [''],
    primaryUse: ['']
  });

  private assetsService = inject(AssetsService);

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private auth: AuthService,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    // no-op
  }

  ngAfterViewInit(): void {
    // focus the modal for accessibility and listen for Escape
    setTimeout(() => {
      try { this.modalCard?.nativeElement?.focus(); } catch (e) { /* ignore */ }
    }, 50);
    this._escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') this.onClose(); };
    document.addEventListener('keydown', this._escHandler);
  }

  ngOnDestroy(): void {
    if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
  }

  onClose() {
    this.close.emit();
  }

  async onSubmit() {
    if (this.form.invalid) {
      // simple client-side guard
      this.toast.show('Please complete required fields and accept the User Service Agreement to continue.', 'error');
      return;
    }

    const usaStatus = this.form.get('usaStatus')?.value;
    if (usaStatus !== 'agreed') {
      this.toast.show('You must agree to the User Service Agreement to activate your account.', 'error');
      return;
    }

    this.submitting = true;
    try {
      const uid = this.auth.currentUser?.uid;
      if (!uid) throw new Error('Not signed in');

      // persist usa status under a 'usa' object on the user doc
      await this.userService.updateUserProfile(uid, { usa: { usaStatus: 'agreed', agreedAt: Date.now() } });

      const vehicleData: Record<string, any> = {
        make: this.form.get('vehicleMake')?.value,
        vehicleClass: this.form.get('vehicleClass')?.value,
        numberPlate: this.form.get('numberPlate')?.value,
        year: this.form.get('year')?.value,
        bodyType: this.form.get('bodyType')?.value,
        garagingAddress: this.form.get('garagingAddress')?.value,
        vin: this.form.get('vin')?.value,
        primaryUse: this.form.get('primaryUse')?.value,
        assetValue: '0', // Default since step 3 is removed
        safetyFeatures: '', // Default since step 3 is removed
        uid: uid,
        userId: uid,
        createdAt: serverTimestamp(),
        status: 'Pending',
        documents: []
      };

      await this.assetsService.addVehicleAsset(vehicleData as any);

      this.toast.show('Account activation submitted', 'success');
      // emit close so parent can hide modal and re-check
      this.close.emit();
    } catch (err: any) {
      console.error('Account init submit failed', err);
      this.toast.show(err?.message || 'Failed to submit activation', 'error');
    } finally {
      this.submitting = false;
    }
  }
}

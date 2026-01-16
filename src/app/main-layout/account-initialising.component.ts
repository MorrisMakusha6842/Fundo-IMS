import { Component, EventEmitter, Output, Input, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UserService } from '../services/user.service';
import { AuthService } from '../services/auth.service';
import { VehicleRegisterService } from '../services/vehicle-register.service';
import { ToastService } from '../services/toast.service';

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
    primaryUse: [''] ,
    currentValue: ['']
  });

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private auth: AuthService,
    private vehicleService: VehicleRegisterService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    // no-op
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
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

      // create vehicle-register doc with uid as id
      // gather file inputs (radio licence, insurance, inspection) and convert to data URLs
      const fileInputs: NodeListOf<HTMLInputElement> = document.querySelectorAll('.modal-card input[type=file]');
      const docs: Array<Record<string, any>> = [];
      for (let i = 0; i < fileInputs.length; i++) {
        const f = fileInputs[i];
        if (f.files && f.files.length) {
          try {
            const dataUrl = await this.fileToDataUrl(f.files[0]);
            docs.push({ name: f.files[0].name, field: f.previousElementSibling?.textContent?.trim() || `file${i}`, dataUrl });
          } catch (e) {
            console.warn('failed to read file input', e);
          }
        }
      }

      const vehicleData: Record<string, any> = {
        make: this.form.get('vehicleMake')?.value,
        vehicleClass: this.form.get('vehicleClass')?.value,
        numberPlate: this.form.get('numberPlate')?.value,
        year: this.form.get('year')?.value,
        bodyType: this.form.get('bodyType')?.value,
        garagingAddress: this.form.get('garagingAddress')?.value,
        vin: this.form.get('vin')?.value,
        primaryUse: this.form.get('primaryUse')?.value,
        currentValue: this.form.get('currentValue')?.value
      };

      if (docs.length) vehicleData['documents'] = docs;
      await this.vehicleService.createOrUpdate(uid, vehicleData);

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

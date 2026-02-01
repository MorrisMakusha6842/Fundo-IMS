import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { BillingInformationService, BillingAccount } from '../financial-insight/billing-information.service';
import { AuthService } from '../services/auth.service';
import { serverTimestamp } from '@angular/fire/firestore';

@Component({
    selector: 'app-billing-information',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './billing-information.component.html',
    styleUrls: ['./billing-information.component.scss']
})
export class BillingInformationComponent implements OnInit {
    private billingService = inject(BillingInformationService);
    private authService = inject(AuthService);
    private fb = inject(FormBuilder);

    accounts: BillingAccount[] = [];
    currentUser: any = null;

    showForm = false;
    isEditing = false;
    accountForm: FormGroup;

    constructor() {
        this.accountForm = this.fb.group({
            id: [null],
            accountName: ['', Validators.required],
            phoneNumber: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
            provider: ['Ecocash', Validators.required],
            status: ['Active'],
            expDate: ['', Validators.required],
            accountPassword: ['', [Validators.required, Validators.minLength(4)]],
            confirmPassword: ['', Validators.required]
        }, { validators: this.passwordMatchValidator });
    }

    ngOnInit() {
        this.authService.user$.subscribe(user => {
            this.currentUser = user;
            if (user) {
                this.billingService.getUserAccounts(user.uid).subscribe(accounts => {
                    this.accounts = accounts;
                });
            }
        });
    }

    passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
        const password = control.get('accountPassword');
        const confirm = control.get('confirmPassword');
        return password && confirm && password.value === confirm.value ? null : { passwordMismatch: true };
    }

    initAddAccount() {
        if (this.accounts.length >= 2) return;
        this.isEditing = false;
        this.accountForm.reset({ provider: 'Ecocash', status: 'Active' });
        this.showForm = true;
    }

    editAccount(account: BillingAccount) {
        this.isEditing = true;
        this.accountForm.patchValue(account);
        this.showForm = true;
    }

    cancelForm() {
        this.showForm = false;
    }

    async saveAccount() {
        if (this.accountForm.invalid || !this.currentUser) return;

        // Extract confirmPassword to exclude it from the saved object
        const { confirmPassword, ...formVal } = this.accountForm.value;

        if (this.isEditing && formVal.id) {
            await this.billingService.updateAccount(formVal);
        } else {
            const newAccount: BillingAccount = {
                ...formVal,
                uid: this.currentUser.uid,
                createdAt: serverTimestamp()
            };
            await this.billingService.addAccount(newAccount);
        }
        this.showForm = false;
    }

    async deleteAccount(id: string) {
        if (confirm('Are you sure you want to remove this payment method?')) {
            await this.billingService.deleteAccount(id);
        }
    }
}
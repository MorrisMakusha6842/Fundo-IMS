import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountReceivableService, PaymentAccount } from './account-receivable.service';

@Component({
    selector: 'app-account-receivable',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './account-receivable.component.html',
    styleUrls: ['./account-receivable.component.scss']
})
export class AccountReceivableComponent implements OnInit {
    private accountService = inject(AccountReceivableService);
    accounts: PaymentAccount[] = [];
    showForm = false;
    accountForm: FormGroup;
    isEditing = false;

    constructor(private fb: FormBuilder) {
        this.accountForm = this.fb.group({
            id: [null],
            name: ['', Validators.required],
            provider: ['Ecocash', Validators.required],
            accountNumber: ['', Validators.required],
            paynowId: ['', Validators.required],
            paynowKey: ['', Validators.required],
            status: ['Active']
        });
    }

    ngOnInit(): void {
        this.accountService.getAccounts().subscribe(data => {
            this.accounts = data;
        });
    }

    initAddAccount() {
        if (this.accounts.length >= 5) return;
        this.isEditing = false;
        this.accountForm.reset({ provider: 'Ecocash', status: 'Active' });
        this.showForm = true;
    }

    cancelForm() {
        this.showForm = false;
    }

    saveAccount() {
        if (this.accountForm.invalid) return;

        const formVal = this.accountForm.value;

        if (this.isEditing) {
            // Update existing
            const index = this.accounts.findIndex(a => a.id === formVal.id);
            if (index !== -1) {
                this.accounts[index] = { ...formVal };
            }
        } else {
            // Add new
            const newAccount: PaymentAccount = {
                ...formVal,
                id: Date.now().toString()
            };
            this.accounts.push(newAccount);
        }

        this.showForm = false;
    }

    editAccount(account: PaymentAccount) {
        this.isEditing = true;
        this.accountForm.patchValue(account);
        this.showForm = true;
    }

    deleteAccount(id: string) {
        if (confirm('Are you sure you want to remove this payment method?')) {
            this.accounts = this.accounts.filter(a => a.id !== id);
        }
    }
}
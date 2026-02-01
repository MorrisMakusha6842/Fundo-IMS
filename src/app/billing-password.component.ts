import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-billing-password',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="payment-backdrop">
      <div class="payment-modal">
        <!-- Header -->
        <div class="modal-header">
          <h2 *ngIf="hasAccount">Verify it's you</h2>
          <h2 *ngIf="!hasAccount">Account Required</h2>
          <p class="subtitle" *ngIf="hasAccount">
            For security, please enter your account password to authorise this payment.
          </p>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Password Field -->
          <div class="form-group" *ngIf="hasAccount">
            <label for="password">Account Password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="password"
              placeholder="Enter your password"
            />
            <small class="helper-text">
              This helps protect your account from unauthorised payments.
            </small>
          </div>

          <!-- Account Required State -->
          <div class="account-required-state" *ngIf="!hasAccount">
            <div class="icon-circle">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
            <p class="primary-msg">
              You need an active billing account to complete this purchase.
            </p>
            <p class="secondary-msg">
              Create a billing account to save payments, access policies, and manage renewals.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn secondary" (click)="onCancel()">Cancel</button>
          
          <button class="btn primary" *ngIf="hasAccount" (click)="onConfirm()">Confirm & Pay</button>
          
          <ng-container *ngIf="!hasAccount">
            <button class="btn secondary" (click)="onSignIn()">Sign In</button>
            <button class="btn primary" (click)="onCreateAccount()">Create Billing Account</button>
          </ng-container>
        </div>
      </div>
    </div>
    `,
    styles: [`
        .payment-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .payment-modal { width: 100%; max-width: 420px; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); overflow: hidden; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        
        /* Header */
        .modal-header { padding: 24px 24px 16px; border-bottom: 1px solid #e5e7eb; }
        .modal-header h2 { margin: 0; font-size: 20px; font-weight: 600; color: #111827; }
        .modal-header .subtitle { margin-top: 6px; font-size: 14px; color: #6b7280; line-height: 1.4; }

        /* Body */
        .modal-body { padding: 24px; }
        .form-group { display: flex; flex-direction: column; }
        .form-group label { font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; }
        .form-group input { height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 14px; outline: none; transition: border 0.15s ease, box-shadow 0.15s ease; }
        .form-group input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
        .form-group .helper-text { margin-top: 6px; font-size: 12px; color: #6b7280; }

        /* Account Required State */
        .account-required-state { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 16px 0 24px; }
        .account-required-state .icon-circle { width: 64px; height: 64px; background-color: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #2563eb; }
        .account-required-state .icon-circle svg { width: 32px; height: 32px; }
        .account-required-state .primary-msg { font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 8px; line-height: 1.4; }
        .account-required-state .secondary-msg { font-size: 13px; color: #6b7280; margin: 0; line-height: 1.5; max-width: 300px; }

        /* Footer */
        .modal-footer { padding: 16px 24px; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #e5e7eb; }
        
        /* Buttons */
        .btn { height: 40px; padding: 0 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
        .btn.secondary { background: #f3f4f6; color: #374151; }
        .btn.secondary:hover { background: #e5e7eb; }
        .btn.primary { background: #2563eb; color: #ffffff; }
        .btn.primary:hover { background: #1d4ed8; }
    `]
})
export class BillingPassword {
    @Input() hasAccount = false;
    @Output() close = new EventEmitter<void>();
    @Output() confirm = new EventEmitter<string>();
    @Output() createAccount = new EventEmitter<void>();
    @Output() signIn = new EventEmitter<void>();

    password = '';

    onCancel() {
        this.close.emit();
    }

    onConfirm() {
        this.confirm.emit(this.password);
    }

    onCreateAccount() {
        this.createAccount.emit();
    }

    onSignIn() {
        this.signIn.emit();
    }
}
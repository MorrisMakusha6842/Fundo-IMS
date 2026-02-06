import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountReceivableService } from '../financial-insight/account-receivable.service';
import { InvoiceService, Invoice } from '../services/invoice.service';
import { firstValueFrom } from 'rxjs';
import { serverTimestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-billing-debit',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './billing-debit.component.html',
  styleUrls: ['./billing-debit.component.scss']
})
export class BillingDebitComponent {
  @Input() purchaseData: any = null;
  @Output() close = new EventEmitter<void>();

  private arService = inject(AccountReceivableService);
  private invoiceService = inject(InvoiceService);

  isProcessing = false;

  closeModal() {
    if (this.isProcessing) return; // Prevent closing while paying
    this.close.emit();
  }

  async processPayment() {
    if (!this.purchaseData || this.isProcessing) return;

    this.isProcessing = true;

    try {
      // 1. Get the Active Receiving Account (Company Account)
      const accounts = await firstValueFrom(this.arService.getAccounts());
      const activeAccount = accounts.find(acc => acc.status === 'Active');

      if (!activeAccount || !activeAccount.id) {
        alert('System Error: No active receiving account found. Please contact support.');
        this.isProcessing = false;
        return;
      }

      // 2. Prepare Transaction Data
      const transactionData = {
        userId: this.purchaseData.userId,
        amount: this.purchaseData.premium,
        currency: 'USD',
        status: 'Approved', // Mocking Paynow success
        description: `Premium for ${this.purchaseData.policy?.policyName}`,
        policyId: this.purchaseData.policy?.id || 'unknown',
        assetId: this.purchaseData.selectedAsset?.id,
        breakdown: this.purchaseData.breakdown
      };

      // 3. Save to Account Receivable (Payment History)
      await this.arService.recordTransaction(activeAccount.id, transactionData);

      // 4. Generate Invoice upon successful payment
      const invoiceData: Invoice = {
        assetId: this.purchaseData.selectedAsset?.id,
        assetName: `${this.purchaseData.selectedAsset?.make} ${this.purchaseData.selectedAsset?.model}`,
        clientId: this.purchaseData.userId,
        clientName: this.purchaseData.clientName,
        amount: this.purchaseData.premium,
        status: 'Paid',
        createdAt: serverTimestamp(),
        generatedBy: 'System',
        description: `Insurance Premium: ${this.purchaseData.policy?.policyName}`,
        invoiceType: 'receipt', // It's a receipt since it's paid
        policyId: this.purchaseData.policy?.id,
        policyName: this.purchaseData.policy?.policyName,
        policyType: this.purchaseData.policy?.policyType
      };

      await this.invoiceService.createInvoice(invoiceData);

      alert('Payment Successful! Invoice generated.');
      this.close.emit();

    } catch (error) {
      console.error('Payment processing failed:', error);
      alert('Payment failed. Please try again.');
    } finally {
      this.isProcessing = false;
    }
  }
}
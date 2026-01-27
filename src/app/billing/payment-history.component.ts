import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-payment-history',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Payment History</h2>
      <p class="text-gray-500">View your past transactions and download invoices.</p>
      <!-- Placeholder for History Table -->
    </div>
  `
})
export class PaymentHistoryComponent { }
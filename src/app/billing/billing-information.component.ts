import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-billing-information',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Billing Information</h2>
      <p class="text-gray-500">Manage your billing address and tax information here.</p>
      <!-- Placeholder for Billing Info Form -->
    </div>
  `
})
export class BillingInformationComponent { }
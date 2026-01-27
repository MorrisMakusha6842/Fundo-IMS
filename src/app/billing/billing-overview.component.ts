import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-billing-overview',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Billing Overview</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p class="text-sm text-blue-600 font-medium">Total Outstanding</p>
          <p class="text-2xl font-bold text-blue-900">$1,250.00</p>
        </div>
        <div class="p-4 bg-green-50 rounded-lg border border-green-100">
          <p class="text-sm text-green-600 font-medium">Paid this Month</p>
          <p class="text-2xl font-bold text-green-900">$450.00</p>
        </div>
        <div class="p-4 bg-purple-50 rounded-lg border border-purple-100">
          <p class="text-sm text-purple-600 font-medium">Next Invoice Date</p>
          <p class="text-2xl font-bold text-purple-900">Oct 1, 2023</p>
        </div>
      </div>
    </div>
  `
})
export class BillingOverviewComponent { }
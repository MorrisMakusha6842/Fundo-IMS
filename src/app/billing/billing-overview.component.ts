import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-billing-overview',
    standalone: true,
    imports: [CommonModule],
    styleUrl: './billing-overview.component.scss',
    template: `
    <div class="billing-overview">
  <!-- HEADER -->
  <div class="billing-header">
    <h2>Billing Overview</h2>

    <div class="billing-filters">
      <select class="filter-select">
        <option>Last 7 days</option>
        <option>Last 30 days</option>
        <option>Last 90 days</option>
      </select>
    </div>
  </div>

  <!-- SUMMARY SECTION -->
  <div class="billing-summary">

    <!-- CARD 1: Total Premium Collection (Far Left) -->
    <div class="summary-card">
      <div class="card-header">
        <span>Total Premium Collection</span>
        <span class="trend negative">▼ 4.7%</span>
      </div>

      <div class="card-value">
        $5,893.00
      </div>

      <div class="card-subtext">
        Total cashed this month
      </div>
    </div>

    <!-- CARD 2: Lapsed Payments (Center) -->
    <div class="summary-card">
      <div class="card-header">
        <span>Lapsed Payments</span>
        <span class="trend negative">▼ 2.1%</span>
      </div>

      <div class="card-value">
        $1,250.00
      </div>

      <div class="card-subtext">
        Missed due dates
      </div>
    </div>

    <!-- CARD 3: Active Accounts (Far Right) -->
    <div class="summary-card">
      <div class="card-header">
        <span>Active Accounts</span>
        <span class="trend positive">▲ 12%</span>
      </div>

      <div class="card-value">
        142
      </div>

      <div class="card-subtext">
        Made payments previously
      </div>

      <div class="card-action">
        <button class="btn-link" (click)="openActiveAccountsModal()">
          View Details
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>

  </div>

  <!-- LEDGER / USAGE SECTION -->
  <div class="billing-ledger">

    <div class="ledger-header">
      <h3>Ledger Summary</h3>
      <button class="btn-secondary">Export CSV</button>
    </div>

    <div class="ledger-chart">
      <div class="chart-placeholder-box">Chart Area (Coming Soon)</div>
    </div>

    <div class="ledger-legend">
      <div class="legend-item">
        <span class="dot collected"></span>
        Premiums Collected
        <strong>$5,893.00</strong>
      </div>

      <div class="legend-item">
        <span class="dot outstanding"></span>
        Outstanding
        <strong>$8,393.00</strong>
      </div>

      <div class="legend-item">
        <span class="dot projected"></span>
        Projected (Renewals)
        <strong>$12,393.00</strong>
      </div>
    </div>

  </div>

</div>

<!-- ACTIVE ACCOUNTS MODAL -->
<div class="modal-overlay" *ngIf="isActiveAccountsModalOpen">
  <div class="modal-card">
    <div class="modal-header">
      <h2>Active Accounts</h2>
      <button class="btn-close" (click)="closeActiveAccountsModal()">×</button>
    </div>
    <div class="modal-body">
      <table class="user-table">
        <thead>
          <tr>
            <th>Account Name</th>
            <th>Account No.</th>
            <th>Last Payment</th>
            <th class="text-right">Total Paid</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let acc of activeAccounts">
            <td>{{ acc.name }}</td>
            <td>{{ acc.accountNo }}</td>
            <td>{{ acc.lastPayment }}</td>
            <td class="text-right">{{ acc.totalPaid | currency }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" (click)="closeActiveAccountsModal()">Close</button>
    </div>
  </div>
</div>
  `
})
export class BillingOverviewComponent {
    isActiveAccountsModalOpen = false;

    // Dummy data for the modal
    activeAccounts = [
        { name: 'John Doe', accountNo: 'ACC-001', lastPayment: '2023-10-01', totalPaid: 1200 },
        { name: 'Jane Smith', accountNo: 'ACC-002', lastPayment: '2023-09-28', totalPaid: 850 },
        { name: 'Acme Corp', accountNo: 'CORP-101', lastPayment: '2023-10-05', totalPaid: 5000 },
        { name: 'Robert Brown', accountNo: 'ACC-005', lastPayment: '2023-10-02', totalPaid: 320 },
        { name: 'Sarah Connor', accountNo: 'ACC-009', lastPayment: '2023-10-06', totalPaid: 1500 },
    ];

    openActiveAccountsModal() {
        this.isActiveAccountsModalOpen = true;
    }

    closeActiveAccountsModal() {
        this.isActiveAccountsModalOpen = false;
    }
}
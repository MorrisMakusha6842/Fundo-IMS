import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { AccountReceivableService } from '../financial-insight/account-receivable.service';
import { BillingInformationService, BillingAccount } from '../financial-insight/billing-information.service';
import { Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface BillingTrend {
  date: string;          // 2026-01-01
  collected: number;     // cumulative
  forecast?: number;     // optional future
}

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
        {{ totalPremium | currency }}
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
        {{ activeAccountsCount }}
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
      <h3>Premium Collection Summary</h3>
      <div class="header-actions">
        <select class="filter-select">
            <option>This Month</option>
            <option>Last Month</option>
            <option>Quarter to Date</option>
        </select>
        <button class="btn-secondary">Export CSV</button>
      </div>
    </div>

    <div class="ledger-chart-container">
      <!-- SVG Graph: Premium Collection Trend -->
      <svg viewBox="0 0 1000 300" preserveAspectRatio="none" class="chart-svg">
          <defs>
              <linearGradient id="collectedGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#0071e3" stop-opacity="0.2"/>
                  <stop offset="100%" stop-color="#0071e3" stop-opacity="0"/>
              </linearGradient>
          </defs>

          <!-- Grid Lines -->
          <line x1="0" y1="250" x2="1000" y2="250" class="grid-line" />
          <line x1="0" y1="150" x2="1000" y2="150" class="grid-line" />
          <line x1="0" y1="50" x2="1000" y2="50" class="grid-line" />

          <!-- Target Line (Dotted) -->
          <line x1="0" y1="80" x2="1000" y2="80" class="target-line" />
          <text x="10" y="75" class="chart-label target-label">Target: {{ monthlyTarget | currency }}</text>

          <!-- Forecast Line (Dashed) -->
          <path d="M 500 180 Q 750 100 1000 60" class="forecast-line" />

          <!-- Actual Collected Area (Filled) -->
          <path d="M 0 300 L 0 280 Q 250 250 500 180 L 500 300 Z" class="collected-area" />
          <path d="M 0 280 Q 250 250 500 180" class="collected-line" />

          <!-- Current Day Indicator -->
          <circle cx="500" cy="180" r="4" class="current-dot" />
          <line x1="500" y1="180" x2="500" y2="300" class="current-line" />
          
          <!-- Axis Labels -->
          <text x="0" y="295" class="axis-label">Day 1</text>
          <text x="500" y="295" class="axis-label">Today</text>
          <text x="980" y="295" class="axis-label text-right">Day 30</text>
      </svg>
    </div>

    <div class="ledger-legend">
      <div class="legend-item">
        <span class="dot collected"></span>
        Actual Collected
        <strong>$5,893.00</strong>
      </div>

      <div class="legend-item">
        <span class="dot forecast"></span>
        Forecast
        <strong>$13,500.00</strong>
      </div>

      <div class="legend-item">
        <span class="dot target"></span>
        Monthly Target
        <strong>{{ monthlyTarget | currency }}</strong>
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
            <th>Name</th>
            <th>Provider</th>
            <th>Phone / Account</th>
            <th class="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let acc of activeAccountsList">
            <td>{{ acc.accountName }}</td>
            <td>{{ acc.provider }}</td>
            <td>{{ acc.phoneNumber }}</td>
            <td class="text-right">
                <span class="badge" [ngClass]="acc.status === 'Active' ? 'success' : 'warning'">{{ acc.status }}</span>
            </td>
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
export class BillingOverviewComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private accountService = inject(AccountReceivableService);
  private billingService = inject(BillingInformationService);

  isActiveAccountsModalOpen = false;

  // Data Model Properties
  monthlyTarget: number = 12393;
  totalPremium: number = 0;
  activeAccountsCount: number = 0;
  activeAccountsList: BillingAccount[] = [];

  private subscriptions: Subscription[] = [];

  ngOnInit() {
    // 1. Fetch Total Premium Collection
    const premiumSub = this.authService.userRole$.pipe(
      switchMap(role => {
        const user = this.authService.currentUser;
        if (!user) return of([]);
        return (role === 'admin' || role === 'agent')
          ? this.accountService.getAllPayments()
          : this.accountService.getUserPayments(user.uid);
      })
    ).subscribe(payments => {
      this.totalPremium = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    });
    this.subscriptions.push(premiumSub);

    // 2. Fetch Active Accounts
    const accountsSub = this.authService.userRole$.pipe(
      switchMap(role => {
        const user = this.authService.currentUser;
        if (!user) return of([]);
        return (role === 'admin' || role === 'agent')
          ? this.billingService.getAllAccounts()
          : this.billingService.getUserAccounts(user.uid);
      })
    ).subscribe(accounts => {
      this.activeAccountsList = accounts;
      this.activeAccountsCount = accounts.filter(a => a.status === 'Active').length;
    });
    this.subscriptions.push(accountsSub);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  openActiveAccountsModal() {
    this.isActiveAccountsModalOpen = true;
  }

  closeActiveAccountsModal() {
    this.isActiveAccountsModalOpen = false;
  }
}
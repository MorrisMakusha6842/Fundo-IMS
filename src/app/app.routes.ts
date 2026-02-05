import { ResolveStart, Routes } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { SigngupFormComponent } from './landing-page/signgup-form.component';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { AuthGuard } from './guards/auth.guard';
import { DashboardComponent } from './dashboard/dashboard.component';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { RemindersComponent } from './services/reminders.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { BillingComponent } from './billing/billing.component';
import { PoliciesComponent } from './policies/policies.component';
import { SettingsComponent } from './settings/settings.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { VehicleRegisterComponent } from './vehicle-register/vehicle-register.component';
import { AssetRegistryComponent } from './asset-registry/asset-registry.component';
import { FinancialInsightComponent } from './financial-insight/financial-insight.component';
import { AccountReceivableComponent } from './financial-insight/account-receivable.component';
import { BillingOverviewComponent } from './billing/billing-overview.component';
import { BillingInformationComponent } from './billing/billing-information.component';
import { PaymentHistoryComponent } from './billing/payment-history.component';
import { ClaimsManagementComponent } from './claims-management/claims-management.component';

export const routes: Routes = [
  {
    path: 'landing-page',
    component: LandingPageComponent
  },
  {
    path: 'signup/client',
    component: SigngupFormComponent
  }

  , {
    path: '',
    component: LoginComponent
  }

  , {
    path: 'main-layout',
    component: MainLayoutComponent,
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' }, // No guard needed for redirect
      { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
      { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
      { path: 'notifications', component: NotificationsComponent, canActivate: [AuthGuard] },
      { path: 'reminders', component: RemindersComponent, canActivate: [AuthGuard] },
      { path: 'analytics', component: AnalyticsComponent, canActivate: [AuthGuard] },
      {
        path: 'billing',
        component: BillingComponent,
        canActivate: [AuthGuard],
        children: [
          { path: '', redirectTo: 'overview', pathMatch: 'full' },
          { path: 'overview', component: BillingOverviewComponent },
          { path: 'information', component: BillingInformationComponent },
          { path: 'receivable', component: AccountReceivableComponent },
          { path: 'history', component: PaymentHistoryComponent }
        ]
      },
      { path: 'financial-insight', component: FinancialInsightComponent, canActivate: [AuthGuard] },
      { path: 'policies', component: PoliciesComponent, canActivate: [AuthGuard], data: { roles: ['admin', 'agent'] } },
      { path: 'settings', component: SettingsComponent, canActivate: [AuthGuard] },
      { path: 'user-management', component: UserManagementComponent, canActivate: [AuthGuard], data: { roles: ['admin', 'agent'] } },
      { path: 'vehicle-register', component: VehicleRegisterComponent, canActivate: [AuthGuard] },
      { path: 'asset-registry', component: AssetRegistryComponent, canActivate: [AuthGuard] },
      { path: 'claims-management', component: ClaimsManagementComponent, canActivate: [AuthGuard], data: { roles: ['admin', 'agent'] } },
    ]
  },
  // Fallback route here 

];

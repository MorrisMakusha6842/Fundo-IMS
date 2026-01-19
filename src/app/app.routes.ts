import { ResolveStart, Routes } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { SigngupFormComponent } from './landing-page/signgup-form.component';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { AuthGuard } from './guards/auth.guard';
import { DashboardComponent } from './dashboard/dashboard.component';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { ReminderComponent } from './reminder/reminder.component';
import { AnalyticsComponent } from './analytics/analytics.component';
import { BillingComponent } from './billing/billing.component';
import { PoliciesComponent } from './policies/policies.component';
import { SettingsComponent } from './settings/settings.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { VehicleRegisterComponent } from './vehicle-register/vehicle-register.component';
import { AssetRegistryComponent } from './asset-registry/asset-registry.component';

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
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', component: HomeComponent },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: 'reminder', component: ReminderComponent },
      { path: 'analytics', component: AnalyticsComponent },
      { path: 'billing', component: BillingComponent },
      { path: 'policies', component: PoliciesComponent },
      { path: 'settings', component: SettingsComponent },
      { path: 'user-management', component: UserManagementComponent },
      { path: 'vehicle-register', component: VehicleRegisterComponent },
      { path: 'asset-registry', component: AssetRegistryComponent },
    ]
  },
  // Fallback route here 

];



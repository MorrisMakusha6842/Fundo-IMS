import { ResolveStart, Routes } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { SigngupFormComponent } from './landing-page/signgup-form.component';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { AuthGuard } from './guards/auth.guard';
import { LoginComponent } from './login/login.component';

export const routes: Routes = [
  {
    path: 'landing-page',
    component: LandingPageComponent
  },
  {
    path: 'signup/client',
    component: SigngupFormComponent
  }

  ,{
    path: '',
    component: LoginComponent
  }

  ,{
    path: 'app',
    component: MainLayoutComponent,
    canActivate: [AuthGuard]
  }

];



import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-landing-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss'
})
export class LandingPageComponent {
    constructor(private router: Router, private auth: AuthService, private toast: ToastService) {}
  parentError: string | null = null;

  navigateTo(path: 'login' | 'landing-page') {
    // use simple named navigation to keep templates consistent
    if (path === 'login') this.router.navigate(['/']);
    else this.router.navigate(['/landing-page']);
  }

  async signInWithGoogle() {
    try {
      const cred = await this.auth.signInWithGoogle();
      const user = (cred as any)?.user;
      // Always route Google sign-ins to the signup form so users can complete profile details
      this.router.navigate(['/signup/client'], { state: { fromGoogle: true, googleData: { email: user?.email, displayName: user?.displayName, photoURL: user?.photoURL } } });
    } catch (err: any) {
      this.toast.show(err?.message || 'Google sign-in failed', 'error');
    }
  }

  continue(form: NgForm) {
    // Do not attempt sign-in here; pass parent form values to the signup child which will create the account
    this.parentError = null;
    if (!form || form.invalid) return;
    const vals = form.value as any;
    if (vals.password !== vals.confirmPassword) {
      this.parentError = 'Passwords do not match.';
      return;
    }
    // Pass the parent form values to the signup child via navigation state
    this.router.navigate(['/signup/client'], { state: { parentData: { email: vals.email, password: vals.password, confirmPassword: vals.confirmPassword } } });
  }
}



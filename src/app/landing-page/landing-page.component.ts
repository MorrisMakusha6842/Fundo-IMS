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
    // Attempt to sign in existing user; if not found, continue to signup flow
    this.parentError = null;
    if (!form || form.invalid) return;
    const vals = form.value as any;
    if (vals.password !== vals.confirmPassword) {
      this.parentError = 'Passwords do not match.';
      return;
    }

    // Try to sign in first
    (async () => {
      try {
        await this.auth.signIn(vals.email, vals.password);
        this.toast.show('Signed in successfully', 'success');
        this.router.navigate(['/app']);
      } catch (err: any) {
        // If user not found, go to signup flow and pass parentData
        const code = err?.code || '';
        if (code === 'auth/user-not-found' || err?.message?.includes('No account')) {
          this.router.navigate(['/signup/client'], { state: { parentData: { email: vals.email, password: vals.password, confirmPassword: vals.confirmPassword } } });
        } else {
          // show error (wrong password or other)
          const msg = err?.message || 'Sign in failed';
          this.parentError = msg;
          this.toast.show(msg, 'error');
        }
      }
    })();
  }
}



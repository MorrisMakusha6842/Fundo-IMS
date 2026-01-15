import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  form: FormGroup;
  submitting = false;
  error: string | null = null;

  constructor(private fb: FormBuilder, private auth: AuthService, private toast: ToastService, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  get f() { return this.form.controls; }

  async submit() {
    this.error = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    try {
      const { email, password } = this.form.value;
      await this.auth.signIn(email, password);
      this.toast.show('Signed in successfully', 'success');
      // wait shortly for auth state; then navigate to main app
      setTimeout(() => this.router.navigate(['/app']), 300);
    } catch (err: any) {
      const msg = err?.message || 'Sign in failed';
      this.error = msg;
      this.toast.show(msg, 'error');
    } finally {
      this.submitting = false;
    }
  }
}

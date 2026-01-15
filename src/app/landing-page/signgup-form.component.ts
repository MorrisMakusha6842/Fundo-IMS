import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../services/user.service';
import { ToastService } from '../services/toast.service';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'app-signup-form',
	standalone: true,
	imports: [CommonModule, ReactiveFormsModule, RouterModule],
	templateUrl: './signgup-form.component.html',
	styleUrls: ['./signgup-form.component.scss']
})
export class SigngupFormComponent implements OnInit {
	form: FormGroup;
	submitting = false;
	error: string | null = null;
	parentData: any = null;

			constructor(private fb: FormBuilder, private userService: UserService, private toast: ToastService, private auth: AuthService, private router: Router) {
			this.form = this.fb.group({
						fullName: ['', [Validators.required, Validators.minLength(2)]],
						company: ['', []],
						numberPlate: ['', []],
				location: ['', [Validators.required, Validators.minLength(2)]],
				email: ['', [Validators.required, Validators.email]],
				password: ['', [Validators.required, Validators.minLength(6)]],
				confirmPassword: ['', [Validators.required]]
			});
	}

		ngOnInit(): void {
			// Ensure this component was reached from the landing page with parentData
			const st = history.state as any;
			if (!st || !st.parentData) {
				// If no parent data, redirect back to landing page to force filling parent form
				this.router.navigate(['/']);
				return;
			}
			this.parentData = st.parentData;
			// Pre-fill email/password if available from parent form
			if (this.parentData.email) this.form.patchValue({ email: this.parentData.email });
			if (this.parentData.password) this.form.patchValue({ password: this.parentData.password, confirmPassword: this.parentData.confirmPassword });
		}

	get f() { return this.form.controls; }

	async submit() {
		this.error = null;
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}

		const { fullName, company, numberPlate, location, email, password, confirmPassword } = this.form.value;
		if (password !== confirmPassword) {
			this.error = 'Passwords do not match.';
			return;
		}

		this.submitting = true;
		try {
					const profile = { company, numberPlate, location };
					const cred = await this.userService.createUser(email, password, fullName, profile);
					this.toast.show('Account created successfully — check your email for verification', 'success');

							// Wait for auth state to update (ensure guard sees the logged-in user)
							try {
								const user = await firstValueFrom(this.auth.user$);
								if (user) {
									this.router.navigate(['/app']);
									return;
								}
							} catch (e) {
								// ignore
							}
							// fallback: navigate anyway after small delay
							setTimeout(() => this.router.navigate(['/app']), 800);
		} catch (err: any) {
			const msg = err?.message || 'Failed to create account';
			this.error = msg;
			this.toast.show(msg, 'error');
		} finally {
			this.submitting = false;
		}
	}

}

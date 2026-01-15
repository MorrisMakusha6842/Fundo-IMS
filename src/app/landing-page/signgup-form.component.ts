import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { updateProfile } from 'firebase/auth';
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
		isFromGoogle = false;
  imageFile?: File | null = null;
  imagePreview?: string | null = null;

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
			// Accept either parentData (from landing form) or Google flow (fromGoogle + googleData)
			const st = history.state as any;
			this.parentData = st?.parentData || null;
			this.isFromGoogle = !!st?.fromGoogle;
			if (!this.parentData && !this.isFromGoogle) {
				// If no parent data and not a Google flow, redirect back to login (landing)
				this.router.navigate(['/']);
				return;
			}
			// Pre-fill email/password if available from parent form
			if (this.parentData?.email) this.form.patchValue({ email: this.parentData.email });
			if (this.parentData?.password) this.form.patchValue({ password: this.parentData.password, confirmPassword: this.parentData.confirmPassword });
			// If coming from Google, pre-fill email from googleData and remove password requirement
			if (this.isFromGoogle && st?.googleData?.email) {
				this.form.patchValue({ email: st.googleData.email });
				// make password optional for Google flow
				this.form.get('password')?.clearValidators();
				this.form.get('confirmPassword')?.clearValidators();
				this.form.get('password')?.updateValueAndValidity();
				this.form.get('confirmPassword')?.updateValueAndValidity();
			}
		}

	get f() { return this.form.controls; }

	onFileSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;
		const file = input.files[0];
		this.imageFile = file;
		const reader = new FileReader();
		reader.onload = () => { this.imagePreview = reader.result as string; };
		reader.readAsDataURL(file);
	}

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

				// If user provided an avatar image, upload it to Storage and update profile
				try {
					if (this.imageFile && cred.user?.uid) {
						const url = await this.userService.uploadProfileImage(cred.user.uid, this.imageFile);
						// update auth profile photoURL
						try { await updateProfile(cred.user, { photoURL: url }); } catch (e) { /* ignore */ }
						// update Firestore user doc
						await this.userService.updateUserProfile(cred.user.uid, { photoURL: url });
					}
				} catch (uploadErr) {
					console.warn('avatar upload failed', uploadErr);
				}

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

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
	mediaStream: MediaStream | null = null;
	cameraActive = false;
	cameraModalOpen = false;
	tempImagePreview?: string | null = null;
	tempFile?: File | null = null;

			constructor(private fb: FormBuilder, private userService: UserService, private toast: ToastService, private auth: AuthService, private router: Router) {
			this.form = this.fb.group({
						fullName: ['', [Validators.required, Validators.minLength(2)]],
						nationalId: ['', [Validators.required, Validators.minLength(5)]],
						accountType: ['individual', [Validators.required]],
						company: ['', []],
						phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-]{10,}$/)]],
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

		const { fullName, nationalId, accountType, company, phoneNumber, location, email, password, confirmPassword } = this.form.value;
		// Only validate password match for email/password signup
		if (!this.isFromGoogle) {
			if (password !== confirmPassword) {
				this.error = 'Passwords do not match.';
				return;
			}
		}

		this.submitting = true;
		try {
			const profile = { company, location, nationalId, accountType, phoneNumber };
			if (this.isFromGoogle) {
				// User has been authenticated via Google already — update Firestore profile and auth displayName/photoURL
				const current = this.auth.currentUser;
				if (!current) {
					throw new Error('No authenticated Google user found. Please sign in with Google again.');
				}
				// upload avatar if provided
				let photoURL: string | undefined;
				if (this.imageFile) {
					try { photoURL = await this.userService.uploadProfileImage(current.uid, this.imageFile); } catch (e) { console.warn('avatar upload failed', e); }
				}
				// update auth profile
				try { await updateProfile(current, { displayName: fullName, photoURL: photoURL || current.photoURL || null }); } catch (e) { /* ignore */ }
				// persist profile fields to Firestore
				await this.userService.updateUserProfile(current.uid, { displayName: fullName, company, location, photoURL, nationalId, accountType, phoneNumber });
				this.toast.show('Account information updated', 'success');
				this.router.navigate(['/main-layout']);
				return;
			} else {
				// Regular email/password signup — create user then persist avatar and profile
				const cred = await this.userService.createUser(email, password, fullName, profile);
				this.toast.show('Account created successfully — check your email for verification', 'success');

				if (this.imageFile && cred.user?.uid) {
					try {
						const url = await this.userService.uploadProfileImage(cred.user.uid, this.imageFile);
						try { await updateProfile(cred.user, { photoURL: url }); } catch (e) { /* ignore */ }
						await this.userService.updateUserProfile(cred.user.uid, { photoURL: url });
					} catch (uploadErr) {
						console.warn('avatar upload failed', uploadErr);
					}
				}
				// Wait for auth state to update then navigate
				try {
					const user = await firstValueFrom(this.auth.user$);
						if (user) { this.router.navigate(['/main-layout']); return; }
				} catch (e) { /* ignore */ }
				setTimeout(() => this.router.navigate(['/main-layout']), 800);
			}
		} catch (err: any) {
			const msg = err?.message || 'Failed to create account';
			this.error = msg;
			this.toast.show(msg, 'error');
		} finally {
			this.submitting = false;
		}
	}

	// Camera helpers
	async startCamera() {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			this.toast.show('Camera not supported on this device/browser', 'error');
			return;
		}
		try {
			this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
			this.cameraActive = true;
					// attach stream to modal video element
					const video: HTMLVideoElement | null = document.querySelector('#signupCameraModalVideo');
			if (video) {
				video.srcObject = this.mediaStream;
				await video.play();
			}
		} catch (e: any) {
			this.toast.show('Unable to access camera: ' + (e?.message || e), 'error');
		}
	}

	stopCamera() {
		if (this.mediaStream) {
			this.mediaStream.getTracks().forEach(t => t.stop());
			this.mediaStream = null;
		}
			const video: HTMLVideoElement | null = document.querySelector('#signupCameraModalVideo');
		if (video) {
			video.pause();
			video.srcObject = null;
		}
		this.cameraActive = false;
	}

	async takePhoto() {
			const video: HTMLVideoElement | null = document.querySelector('#signupCameraModalVideo');
		if (!video) return;
		const canvas = document.createElement('canvas');
		canvas.width = video.videoWidth || 640;
		canvas.height = video.videoHeight || 480;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
		const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
		// create a File object from dataUrl
		const blob = await (await fetch(dataUrl)).blob();
		const file = new File([blob], `capture_${Date.now()}.jpg`, { type: blob.type });
			// set temporary preview (user can Save or Retake in modal)
			this.tempImagePreview = dataUrl;
			this.tempFile = file;
	}

		openCameraModal() {
			this.cameraModalOpen = true;
			this.tempImagePreview = null;
			this.tempFile = null;
			this.startCamera();
		}

		async savePhoto() {
			if (!this.tempImagePreview || !this.tempFile) return;
			this.imagePreview = this.tempImagePreview;
			this.imageFile = this.tempFile;
			this.tempImagePreview = null;
			this.tempFile = null;
			this.cameraModalOpen = false;
			this.stopCamera();
		}

		retake() {
			this.tempImagePreview = null;
			this.tempFile = null;
			// keep camera running
		}

}

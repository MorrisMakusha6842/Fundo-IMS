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
		// Basic capability check
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
			this.toast.show('Camera not supported on this device/browser', 'error');
			return;
		}

		// getUserMedia requires a secure context (https) or localhost. Warn if not secure.
		if (location && location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
			this.toast.show('Camera access requires a secure (https) connection. Please run on localhost or over https.', 'error');
			return;
		}

		try {
			// avoid duplicate streams
			if (this.mediaStream) {
				// already streaming
				this.cameraActive = true;
				return;
			}

			// check available devices first to give a clearer message
			let devices = [] as MediaDeviceInfo[];
			try {
				devices = await navigator.mediaDevices.enumerateDevices();
			} catch (enumErr) {
				// ignore enumeration errors and proceed to getUserMedia which will surface a clearer error
			}
			const hasVideoInput = devices.some(d => d.kind === 'videoinput');
			if (!hasVideoInput) {
				this.toast.show('No camera device found on this machine.', 'error');
				return;
			}

			// Try environment-facing first, fall back to user-facing or any available camera if needed
			try {
				this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
			} catch (firstErr) {
				// If no device matches facingMode, try user-facing
				try {
					this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
				} catch (secondErr) {
					// Finally try generic video:true
					try {
						this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
					} catch (thirdErr) {
						throw thirdErr; // will be handled by outer catch
					}
				}
			}
			this.cameraActive = true;

			// Attach the stream after the modal has rendered; use a small delay to ensure element exists
			setTimeout(async () => {
				try {
					const video: HTMLVideoElement | null = document.querySelector('#signupCameraModalVideo');
					if (video) {
						video.srcObject = this.mediaStream;
						// Some browsers require play() to be called in a user gesture; we're already inside click handler
						await video.play().catch(() => { /* ignore play errors */ });
					}
				} catch (attachErr) {
					console.warn('Failed to attach camera stream to video element', attachErr);
				}
			}, 50);

		} catch (err: any) {
			// Map common getUserMedia errors to friendly messages
			const name = err?.name || '';
			switch (name) {
				case 'NotAllowedError':
				case 'PermissionDeniedError':
					this.toast.show('Camera permission was denied. Please allow camera access in your browser settings.', 'error');
					break;
				case 'NotFoundError':
				case 'DevicesNotFoundError':
					this.toast.show('No camera device found on this machine.', 'error');
					break;
				case 'NotReadableError':
				case 'TrackStartError':
					this.toast.show('Unable to access the camera. It may be in use by another application.', 'error');
					break;
				case 'OverconstrainedError':
					this.toast.show('Unable to satisfy camera constraints.', 'error');
					break;
				default:
					this.toast.show('Unable to access camera: ' + (err?.message || err), 'error');
			}
			console.warn('startCamera error', err);
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
			// Delay starting the camera slightly so the modal's video element is in the DOM
			setTimeout(() => this.startCamera(), 50);
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

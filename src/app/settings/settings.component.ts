import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';
import { updateProfile } from 'firebase/auth';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private toast = inject(ToastService);

  userProfile: any = {
    displayName: '',
    firstName: '',
    lastName: '',
    email: '',
    photoURL: ''
  };

  newEmail = '';
  newPassword = '';

  // Delete Account Modal
  isDeleteModalOpen = false;
  deletePassword = '';
  isDeleting = false;
  deleteError = '';

  // UI Toggles
  darkMode = false;

  isSavingProfile = false;
  // Camera & Image Handling
  imageFile?: File | null = null;
  cameraModalOpen = false;
  mediaStream: MediaStream | null = null;
  tempImagePreview?: string | null = null;
  tempFile?: File | null = null;

  async ngOnInit() {
    const user = this.authService.currentUser;
    if (user) {
      this.userProfile.email = user.email;
      this.userProfile.photoURL = user.photoURL;
      this.newEmail = user.email || '';

      const profile = await this.userService.getUserProfile(user.uid);
      if (profile) {
        this.userProfile = { ...this.userProfile, ...profile };
        // Split display name for demo purposes if needed
        if (!this.userProfile.firstName && profile['displayName']) {
          const names = (profile['displayName'] || '').split(' ');
          this.userProfile.firstName = names[0] || '';
          this.userProfile.lastName = names.slice(1).join(' ') || '';
        }
      }
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.imageFile = file;
    const reader = new FileReader();
    reader.onload = () => { this.userProfile.photoURL = reader.result as string; };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.userProfile.photoURL = null;
    this.imageFile = null;
  }

  // Camera Logic
  async startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.toast.show('Camera not supported', 'error');
      return;
    }
    try {
      if (this.mediaStream) return;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      
      setTimeout(async () => {
        const video: HTMLVideoElement | null = document.querySelector('#settingsCameraVideo');
        if (video) {
          video.srcObject = this.mediaStream;
          await video.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      this.toast.show('Unable to access camera: ' + (err?.message || err), 'error');
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    const video: HTMLVideoElement | null = document.querySelector('#settingsCameraVideo');
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  async takePhoto() {
    const video: HTMLVideoElement | null = document.querySelector('#settingsCameraVideo');
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: blob.type });
    
    this.tempImagePreview = dataUrl;
    this.tempFile = file;
  }

  openCameraModal() {
    this.cameraModalOpen = true;
    this.tempImagePreview = null;
    this.tempFile = null;
    setTimeout(() => this.startCamera(), 50);
  }

  savePhoto() {
    if (!this.tempImagePreview || !this.tempFile) return;
    this.userProfile.photoURL = this.tempImagePreview;
    this.imageFile = this.tempFile;
    this.tempImagePreview = null;
    this.tempFile = null;
    this.cameraModalOpen = false;
    this.stopCamera();
  }

  retake() {
    this.tempImagePreview = null;
    this.tempFile = null;
  }

  async updateProfile() {
    const user = this.authService.currentUser;
    if (user) {
      this.isSavingProfile = true;
      try {
        // 1. Upload Image if changed
        let photoURL = this.userProfile.photoURL;
        if (this.imageFile) {
          photoURL = await this.userService.uploadProfileImage(user.uid, this.imageFile);
        }

        // 2. Update Auth Profile
        const displayName = `${this.userProfile.firstName} ${this.userProfile.lastName}`.trim();
        await updateProfile(user, {
          displayName,
          photoURL: photoURL
        });

        // 3. Update Firestore Profile
        await this.userService.updateUserProfile(user.uid, {
          displayName,
          firstName: this.userProfile.firstName,
          lastName: this.userProfile.lastName,
          photoURL: photoURL
        });

        this.toast.show('Profile updated successfully', 'success');
        this.imageFile = null; // Reset file input
      } catch (error: any) {
        this.toast.show('Error updating profile: ' + error.message, 'error');
      } finally {
        this.isSavingProfile = false;
      }
    }
  }

  async onUpdateEmail() {
    try {
      await this.authService.updateEmail(this.newEmail);
      alert('Email updated! Please verify your new email.');
    } catch (error: any) {
      alert('Error updating email: ' + error.message);
    }
  }

  async onUpdatePassword() {
    if (!this.newPassword) return;
    try {
      await this.authService.updatePassword(this.newPassword);
      this.newPassword = '';
      alert('Password updated successfully.');
    } catch (error: any) {
      alert('Error updating password: ' + error.message);
    }
  }

  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    // Basic implementation: toggle class on body
    if (this.darkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  openDeleteModal() {
    this.isDeleteModalOpen = true;
    this.deletePassword = '';
    this.deleteError = '';
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
  }

  async confirmDeleteAccount() {
    if (!this.deletePassword) return;

    this.isDeleting = true;
    this.deleteError = '';

    try {
      const uid = this.authService.currentUser?.uid;
      await this.authService.deleteAccount(this.deletePassword);

      // Optionally delete user data from Firestore
      if (uid) {
        await this.userService.deleteUser(uid);
      }

      this.closeDeleteModal();
      this.router.navigate(['/login']);
    } catch (error: any) {
      console.error(error);
      this.deleteError = error.message || 'Failed to delete account. Please check your password.';
    } finally {
      this.isDeleting = false;
    }
  }

  async logout() {
    try {
      await this.authService.signOut();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Logout failed', error);
    }
  }
}

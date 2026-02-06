import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../services/user.service';
import { NotificationService, Message } from '../services/notification.service';
import { InvoiceService } from '../services/invoice.service';
import { AssetsService } from '../services/assets.service';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { Router } from '@angular/router';
import { Bytes } from '@angular/fire/firestore';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit, AfterViewChecked {
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);
  private invoiceService = inject(InvoiceService);
  private assetsService = inject(AssetsService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  users: any[] = [];
  selectedUser: any = null;
  allMessages: Message[] = [];
  filteredMessages: Message[] = [];
  newMessage: string = '';
  isLoadingUsers = true;
  isLoadingMessages = false;
  isVerifyModalOpen = false;
  selectedInvoice: any = null;

  // Verification & Upload State
  policyFile: File | null = null;
  policyPreview: string | null = null;
  policyDuration: number = 12;
  policyDurationUnit: 'weeks' | 'months' | 'years' = 'months';
  isVerifying = false;
  verificationMessage: string = '';
  cameraModalOpen = false;
  mediaStream: MediaStream | null = null;
  tempImagePreview: string | null = null;
  tempFile: File | null = null;

  messageFilter: 'all' | 'read' | 'unread' = 'all';

  unreadCounts: { [userId: string]: number } = {};

  private usersSubscription?: Subscription;
  private messagesSubscription?: Subscription;
  private unreadSubscription?: Subscription;

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;
  private shouldScrollToBottom = false;

  ngOnInit(): void {
    // Subscribe to auth state to get current user ID for filtering and unread counts
    this.authService.user$.subscribe(user => {
      if (user) {
        this.subscribeToUnread();
        this.fetchAllUsers(user.uid);
      }
    });
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  subscribeToUnread() {
    this.unreadSubscription?.unsubscribe();
    this.unreadSubscription = this.notificationService.getUnreadCountMap().subscribe(counts => {
      this.unreadCounts = counts;
    });
  }

  ngOnDestroy(): void {
    this.usersSubscription?.unsubscribe();
    this.messagesSubscription?.unsubscribe();
    this.unreadSubscription?.unsubscribe();
  }

  fetchAllUsers(currentUserId: string) {
    this.isLoadingUsers = true;
    this.usersSubscription?.unsubscribe(); // Ensure we don't have duplicate subscriptions

    this.usersSubscription = this.userService.getAllUsers().subscribe({
      next: (users) => {
        // Add System User for Notifications
        const systemUser = {
          uid: 'system',
          displayName: 'System Notifications',
          email: 'system@insurance.app',
          role: 'System',
          avatarDataUrl: null
        };

        // Filter out the current authenticated user from the list
        const filteredUsers = users.filter(u => u.uid !== currentUserId);

        this.users = [systemUser, ...filteredUsers];
        this.isLoadingUsers = false;
      },
      error: (error) => {
        console.error('Error fetching users:', error);
        this.isLoadingUsers = false;
      }
    });
  }

  selectUser(user: any) {
    this.selectedUser = user;
    this.messageFilter = 'all'; // Reset filter on new user selection
    this.loadConversation(user.uid);
  }

  loadConversation(userId: string) {
    this.isLoadingMessages = true;
    this.allMessages = [];
    this.filteredMessages = [];
    this.messagesSubscription?.unsubscribe();

    this.messagesSubscription = this.notificationService.getConversation(userId).subscribe({
      next: (messages) => {
        this.allMessages = messages;
        this.applyFilter();
        this.isLoadingMessages = false;
        this.shouldScrollToBottom = true;

        // Trigger the read status update.
        // This updates the message document status (read: true) in Firestore.
        const hasUnread = messages.some(m => !m.read && m.senderId === userId);
        if (hasUnread) {
          this.notificationService.markAsRead(userId);
        }
      },
      error: (error) => {
        console.error('Error loading conversation:', error);
        this.isLoadingMessages = false;
      }
    });
  }

  setFilter(filter: 'all' | 'read' | 'unread') {
    this.messageFilter = filter;
    this.applyFilter();
  }

  applyFilter() {
    if (this.messageFilter === 'unread') {
      // Show only messages received from the other user that are unread
      this.filteredMessages = this.allMessages.filter(m => !m.read && m.senderId === this.selectedUser.uid);
    } else if (this.messageFilter === 'read') {
      // Show sent messages and read received messages
      this.filteredMessages = this.allMessages.filter(m => m.read || m.senderId !== this.selectedUser.uid);
    } else {
      // Show all messages
      this.filteredMessages = [...this.allMessages];
    }
  }

  async sendMessage() {
    if (!this.newMessage.trim() || !this.selectedUser || this.selectedUser.uid === 'system') return;

    try {
      await this.notificationService.sendMessage(this.selectedUser.uid, this.newMessage.trim());
      this.newMessage = '';
      this.shouldScrollToBottom = true;
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  shouldShowDateSeparator(currentMessage: Message, previousMessage: Message | undefined): boolean {
    if (!previousMessage) return true;

    const currentDate = new Date(currentMessage.timestamp);
    const previousDate = new Date(previousMessage.timestamp);

    return !this.isSameDay(currentDate, previousDate);
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  }

  getDateLabel(timestamp: any): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (this.isSameDay(date, today)) {
      return 'Today';
    } else if (this.isSameDay(date, yesterday)) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }

  getUserInitials(user: any): string {
    if (!user) return 'U';
    const name = user.displayName || user.email || 'User';
    return name.charAt(0).toUpperCase();
  }

  viewAsset(assetId?: string) {
    if (assetId) {
      this.router.navigate(['/main-layout/asset-registry']);
    }
  }

  backToUsers() {
    this.selectedUser = null;
  }

  openVerifyModal(invoice: any) {
    this.selectedInvoice = invoice;
    this.policyFile = null;
    this.policyPreview = null;
    this.policyDuration = 12;
    this.policyDurationUnit = 'months';
    this.verificationMessage = `Dear Client,

Your payment has been successfully received and your insurance policy has now been processed. Please find your policy document attached to this message.

For official collection, verification, or any further assistance, you may visit our nearest company branch with a valid ID and proof of payment.

Thank you for choosing our services.`;
    this.isVerifyModalOpen = true;
  }

  closeVerifyModal() {
    this.isVerifyModalOpen = false;
    this.selectedInvoice = null;
    this.stopCamera();
    this.isVerifying = false;
  }

  async confirmVerify() {
    if (!this.selectedInvoice || !this.policyFile) return;
    
    this.isVerifying = true;

    try {
      const currentUser = this.authService.currentUser;
      if (!currentUser) throw new Error('User not authenticated');

      // 1. Calculate Expiry Date
      const expiryDate = this.calculateExpiryPreview();

      // 2. Process Policy Document for Firestore (Binary)
      const storageData = await this.processFileForFirestore(this.policyFile);

      // 3. Update Asset Document with Metadata
      const docData = {
        name: this.policyFile.name,
        type: this.policyFile.type,
        storageData: storageData,
        field: 'Insurance Policy',
        uploadedAt: new Date().toISOString(),
        expiryDate: expiryDate.toISOString(),
        issuedBy: currentUser.uid,
        verifiedAt: new Date().toISOString(),
        policyId: this.selectedInvoice.policyId,
        policyType: this.selectedInvoice.policyType,
        policyName: this.selectedInvoice.policyName
      };

      await this.assetsService.updateAssetDocument(
        this.selectedInvoice.clientId,
        this.selectedInvoice.assetId,
        'Insurance Policy',
        docData
      );

      // 4. Update Invoice Status
      await this.invoiceService.updateInvoice(this.selectedInvoice.id, { status: 'Verified' }, this.selectedInvoice);
      
      // 5. Send Notification with Attachment
      if (this.policyPreview) {
        await this.notificationService.sendMessage(
          this.selectedInvoice.clientId,
          this.verificationMessage,
          {
            name: this.policyFile.name,
            url: this.policyPreview,
            type: this.policyFile.type
          }
        );
      }

      this.toastService.show('Policy issued and verified successfully', 'success');
      this.closeVerifyModal();
    } catch (error) {
      console.error('Error verifying invoice:', error);
      this.toastService.show('Verification failed', 'error');
    } finally {
      this.isVerifying = false;
    }
  }

  calculateExpiryPreview(): Date {
    const date = new Date();
    if (this.policyDurationUnit === 'weeks') {
      date.setDate(date.getDate() + (this.policyDuration * 7));
    } else if (this.policyDurationUnit === 'months') {
      date.setMonth(date.getMonth() + this.policyDuration);
    } else if (this.policyDurationUnit === 'years') {
      date.setFullYear(date.getFullYear() + this.policyDuration);
    }
    return date;
  }

  private async processFileForFirestore(file: File): Promise<Bytes> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const dataUrl = e.target.result;
        const base64 = dataUrl.split(',')[1];
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        resolve(Bytes.fromUint8Array(new Uint8Array(byteNumbers)));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  getInvoiceDate(invoice: any): any {
    if (!invoice?.createdAt) return null;
    // Handle Firestore Timestamp
    if (typeof invoice.createdAt.toDate === 'function') {
      return invoice.createdAt.toDate();
    }
    // Handle seconds/nanoseconds object if toDate is missing
    if (invoice.createdAt.seconds) {
      return new Date(invoice.createdAt.seconds * 1000);
    }
    return invoice.createdAt;
  }

  // --- File Upload Logic ---

  onPolicyFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    this.processSelectedFile(file);
  }

  processSelectedFile(file: File) {
    this.policyFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      this.policyPreview = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removePolicyFile() {
    this.policyFile = null;
    this.policyPreview = null;
  }

  // --- Camera Logic ---

  openCameraModal() {
    this.cameraModalOpen = true;
    this.tempImagePreview = null;
    this.tempFile = null;
    setTimeout(() => this.startCamera(), 50);
  }

  closeCameraModal() {
    this.cameraModalOpen = false;
    this.stopCamera();
  }

  async startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.toastService.show('Camera not supported', 'error');
      return;
    }

    try {
      if (this.mediaStream) return;

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      
      setTimeout(async () => {
        const video: HTMLVideoElement | null = document.querySelector('#verifyCameraVideo');
        if (video) {
          video.srcObject = this.mediaStream;
          await video.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      console.warn('Camera error', err);
      this.toastService.show('Unable to access camera', 'error');
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    const video: HTMLVideoElement | null = document.querySelector('#verifyCameraVideo');
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  async takePhoto() {
    const video: HTMLVideoElement | null = document.querySelector('#verifyCameraVideo');
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: blob.type });
    
    this.tempImagePreview = dataUrl;
    this.tempFile = file;
  }

  retake() {
    this.tempImagePreview = null;
    this.tempFile = null;
  }

  savePhoto() {
    if (this.tempFile && this.tempImagePreview) {
      this.policyFile = this.tempFile;
      this.policyPreview = this.tempImagePreview;
      this.closeCameraModal();
    }
  }
}

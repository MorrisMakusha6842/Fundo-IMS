import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../services/user.service';
import { NotificationService, Message } from '../services/notification.service';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';

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
  private authService = inject(AuthService);
  private router = inject(Router);

  users: any[] = [];
  selectedUser: any = null;
  allMessages: Message[] = [];
  filteredMessages: Message[] = [];
  newMessage: string = '';
  isLoadingUsers = true;
  isLoadingMessages = false;

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
}

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../services/user.service';
import { NotificationService, Message } from '../services/notification.service';
import { AuthService } from '../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss'
})
export class NotificationsComponent implements OnInit {
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);

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

  ngOnInit(): void {
    this.fetchAllUsers();

    // Subscribe to unread counts
    this.authService.user$.subscribe(user => {
      if (user) {
        this.subscribeToUnread(user.uid);
      }
    });
  }

  subscribeToUnread(uid: string) {
    this.unreadSubscription?.unsubscribe();
    this.unreadSubscription = this.notificationService.getUnreadMessages(uid).subscribe(msgs => {
      this.unreadCounts = {};
      msgs.forEach(m => {
        this.unreadCounts[m.senderId] = (this.unreadCounts[m.senderId] || 0) + 1;
      });
    });
  }

  ngOnDestroy(): void {
    this.usersSubscription?.unsubscribe();
    this.messagesSubscription?.unsubscribe();
    this.unreadSubscription?.unsubscribe();
  }

  fetchAllUsers() {
    this.isLoadingUsers = true;
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
        this.users = [systemUser, ...users];
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

        // Only mark as read if there are unread messages from this sender
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
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  getUserInitials(user: any): string {
    if (!user) return 'U';
    const name = user.displayName || user.email || 'User';
    return name.charAt(0).toUpperCase();
  }
}

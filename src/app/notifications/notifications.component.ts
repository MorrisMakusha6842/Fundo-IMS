import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../services/user.service';
import { NotificationService, Message } from '../services/notification.service';
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

  users: any[] = [];
  selectedUser: any = null;
  messages: Message[] = [];
  newMessage: string = '';
  isLoadingUsers = true;
  isLoadingMessages = false;

  private usersSubscription?: Subscription;
  private messagesSubscription?: Subscription;

  ngOnInit(): void {
    this.fetchAllUsers();
  }

  ngOnDestroy(): void {
    this.usersSubscription?.unsubscribe();
    this.messagesSubscription?.unsubscribe();
  }

  fetchAllUsers() {
    this.isLoadingUsers = true;
    this.usersSubscription = this.userService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
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
    this.loadConversation(user.uid);
  }

  loadConversation(userId: string) {
    this.isLoadingMessages = true;
    this.messagesSubscription?.unsubscribe();

    this.messagesSubscription = this.notificationService.getConversation(userId).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.isLoadingMessages = false;

        // Mark messages as read
        this.notificationService.markAsRead(userId);
      },
      error: (error) => {
        console.error('Error loading conversation:', error);
        this.isLoadingMessages = false;
      }
    });
  }

  async sendMessage() {
    if (!this.newMessage.trim() || !this.selectedUser) return;

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

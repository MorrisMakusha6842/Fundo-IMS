import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-notification-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-icon.component.html',
  styleUrls: ['./notification-icon.component.scss']
})
export class NotificationIconComponent {
  private notificationService = inject(NotificationService);
  unreadCount$: Observable<number> = this.notificationService.getUnreadCount();
}

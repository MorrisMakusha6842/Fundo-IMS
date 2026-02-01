import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationsComponent } from './notifications.component';
import { UserService } from '../services/user.service';
import { NotificationService } from '../services/notification.service';
import { InvoiceService } from '../services/invoice.service';
import { AuthService } from '../services/auth.service';
import { of } from 'rxjs';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;

  // Mocks
  const userServiceMock = {
    getAllUsers: () => of([])
  };
  const notificationServiceMock = {
    getConversation: () => of([]),
    markAsRead: () => Promise.resolve(),
    getUnreadMessages: () => of([])
  };
  const authServiceMock = {
    user$: of({ uid: 'test-uid' })
  };
  const invoiceServiceMock = {
    updateInvoice: () => Promise.resolve()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: InvoiceService, useValue: invoiceServiceMock }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

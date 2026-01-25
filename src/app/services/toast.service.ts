import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

type ToastType = 'info' | 'success' | 'error' | 'warn';

import { AssetsService } from './assets.service';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private container?: HTMLElement;
  private router = inject(Router);

  constructor(private assetsService: AssetsService) { }

  private ensureContainer() {
    if (this.container) return this.container;
    const c = document.createElement('div');
    c.className = 'app-toast-container';
    Object.assign(c.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px', /* Generous spacing */
      zIndex: '99999'
    });
    document.body.appendChild(c);
    this.container = c;
    return c;
  }

  show(message: string, type: ToastType = 'info', duration = 4000, dismissible = false, title?: string, onClick?: () => void) {
    const c = this.ensureContainer();
    const t = document.createElement('div');
    t.className = `app-toast app-toast-${type}`;
    if (dismissible) {
      t.classList.add('app-toast-dismissible');
    }

    // uniform dark navy background
    const baseBackground = '#0f172a'; // Slate 900
    // icon colors
    let iconColor = '#3b82f6'; // blue-500
    let iconSvg = ''; // SVG path content

    switch (type) {
      case 'success':
        iconColor = '#22c55e'; // green-500
        iconSvg = '<svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        break;
      case 'error':
        iconColor = '#ef4444'; // red-500
        iconSvg = '<svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
        break;
      case 'warn':
        iconColor = '#f59e0b'; // amber-500
        iconSvg = '<svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>';
        break;
      default: // info
        iconColor = '#3b82f6'; // blue-500
        iconSvg = '<svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
    }

    Object.assign(t.style, {
      minWidth: '280px', // slightly wider for icon
      padding: '12px 16px',
      borderRadius: '8px',
      background: baseBackground, // Uniform dark background
      color: '#fff',
      boxShadow: '0 6px 18px rgba(0,0,0,0.25)', // slight stronger shadow
      opacity: '0',
      transform: 'translateY(8px)',
      transition: 'all 220ms ease',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '12px',
      borderLeft: `4px solid ${iconColor}` // logic to match icon color? User just said icon, but border is nice too. I'll stick to icon.
    });

    // Remove left border if strictly following "Applied only to: Left-side icon" 
    // but the dark background usually benefits from a small accent. 
    // The user said "Background remains consistent; only icon color changes".
    // I will REMOVE the border-left and trust the icon.
    t.style.borderLeft = 'none';

    // Create Icon Container
    const iconDiv = document.createElement('div');
    iconDiv.innerHTML = iconSvg;
    Object.assign(iconDiv.style, {
      width: '24px',
      height: '24px',
      color: iconColor,
      flexShrink: '0',
      marginTop: '2px' // align with text line-height
    });
    t.appendChild(iconDiv);

    // Text container
    const textDiv = document.createElement('div');
    Object.assign(textDiv.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      flexGrow: '1'
    });

    if (title) {
      const titleEl = document.createElement('strong');
      titleEl.textContent = title;
      Object.assign(titleEl.style, {
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        lineHeight: '1.4'
      });
      textDiv.appendChild(titleEl);
    }

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    Object.assign(msgSpan.style, {
      fontSize: '14px',
      lineHeight: '1.5',
      color: '#e2e8f0' // Slate 200, slightly softer than pure white for body
    });
    textDiv.appendChild(msgSpan);

    t.appendChild(textDiv);

    let timeout: any;

    if (dismissible) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'app-toast-close';
      closeBtn.innerHTML = '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';
      Object.assign(closeBtn.style, {
        background: 'transparent',
        border: 'none',
        color: '#94a3b8', // non-intrusive close button color
        width: '20px',
        height: '20px',
        cursor: 'pointer',
        padding: '0',
        marginTop: '2px',
        opacity: '0.8',
        flexShrink: '0',
        alignSelf: 'flex-start'
      });
      // hover effect for close button
      closeBtn.onmouseenter = () => closeBtn.style.color = '#fff';
      closeBtn.onmouseleave = () => closeBtn.style.color = '#94a3b8';

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (timeout) clearTimeout(timeout);
        this.removeToast(t);
      });

      t.appendChild(closeBtn);
    }

    c.appendChild(t);
    // animate in
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
    });

    timeout = setTimeout(() => this.removeToast(t), duration);

    // If onClick action is provided, click to execute
    if (onClick) {
      t.style.cursor = 'pointer';
      t.addEventListener('click', () => {
        onClick();
        if (timeout) clearTimeout(timeout);
        this.removeToast(t);
      });
    } else if (!dismissible) {
      // If not dismissible and no action, click to close
      t.addEventListener('click', () => {
        clearTimeout(timeout);
        this.removeToast(t);
      });
    }
  }

  private removeToast(node: HTMLElement) {
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px) scale(0.95)';
    setTimeout(() => node.remove(), 300);
  }

  /**
   * Checks if the user has any assets missing documentation and shows a notification.
   */
  checkAssetCompliance(userId: string) {
    // Subscribe once to get the current state
    this.assetsService.getUserVehicles(userId).subscribe({
      next: (vehicles) => {
        const missingDocsCount = vehicles.filter(v => !v.documents || v.documents.length === 0).length;
        if (missingDocsCount > 0) {
          const body = `${missingDocsCount} Assets are missing documents to verify ownership and unlock renewal or policy purchase. Head to the asset registry.`;
          // Passing 'Action required' as title
          this.show(body, 'warn', 15000, true, 'Action required');
        }
      },
      error: (err) => console.error('Error checking asset compliance', err)
    });
  }

  /**
   * Shows a notification toast for a new message.
   */
  showNotification(senderId: string, messageText: string, senderName?: string) {
    let title = senderId === 'system' ? 'System Notification' : 'New Message';
    if (senderName && senderId !== 'system') {
      title = senderName;
    }
    // Truncate message if it's too long
    const displayContent = messageText.length > 60 ? messageText.substring(0, 60) + '...' : messageText;
    this.show(displayContent, 'info', 5000, true, title, () => {
      this.router.navigate(['/main-layout/notifications']);
    });
  }
}

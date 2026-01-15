import { Injectable } from '@angular/core';

type ToastType = 'info' | 'success' | 'error' | 'warn';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private container?: HTMLElement;

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
      gap: '8px',
      zIndex: '99999'
    });
    document.body.appendChild(c);
    this.container = c;
    return c;
  }

  show(message: string, type: ToastType = 'info', duration = 4000) {
    const c = this.ensureContainer();
    const t = document.createElement('div');
    t.className = `app-toast app-toast-${type}`;
    Object.assign(t.style, {
      minWidth: '220px',
      padding: '10px 14px',
      borderRadius: '8px',
      color: '#fff',
      boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
      opacity: '0',
      transform: 'translateY(8px)',
      transition: 'all 220ms ease'
    });

    // background by type
    switch (type) {
      case 'success': t.style.background = '#16a34a'; break;
      case 'error': t.style.background = '#dc2626'; break;
      case 'warn': t.style.background = '#f59e0b'; break;
      default: t.style.background = '#374151';
    }

    t.textContent = message;
    c.appendChild(t);
    // animate in
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
    });

    const timeout = setTimeout(() => this.removeToast(t), duration);
    t.addEventListener('click', () => {
      clearTimeout(timeout);
      this.removeToast(t);
    });
  }

  private removeToast(node: HTMLElement) {
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 220);
  }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'tally-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      <div
        *ngFor="let t of toast.toasts(); trackBy: trackId"
        class="toast"
        [class.error]="t.type === 'error'"
        [class.success]="t.type === 'success'"
        [class.info]="t.type === 'info'"
        [class.removing]="t.removing"
        (click)="toast.dismiss(t.id)"
        role="alert"
      >
        <span class="toast-icon">{{ iconFor(t.type) }}</span>
        <span class="toast-msg">{{ t.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed; bottom: calc(env(safe-area-inset-bottom, 0px) + 88px); left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: column; gap: 8px;
      z-index: 9000; width: min(390px, 92vw); pointer-events: none;
    }
    .toast {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 16px; border-radius: 12px;
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 500;
      line-height: 1.4; cursor: pointer; pointer-events: all;
      box-shadow: 0 4px 16px rgba(0,0,0,0.14);
      animation: toast-in 0.22s ease-out;
    }
    .toast.removing {
      animation: toast-out 0.2s ease-in forwards;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toast-out {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(8px); }
    }
    .toast.error   { background: var(--toast-error-bg); color: var(--toast-error-text); border: 1px solid rgba(220,38,38,0.2); }
    .toast.success { background: var(--tally-green-light); color: var(--tally-green); border: 1px solid rgba(26,122,74,0.2); }
    .toast.info    { background: var(--info-bg); color: var(--info-text); border: 1px solid var(--info-border); }
    .toast-icon { flex-shrink: 0; font-size: 14px; line-height: 1.4; }
    .toast-msg  { flex: 1; }
  `],
})
export class ToastComponent {
  toast = inject(ToastService);
  trackId = (_: number, t: { id: number }) => t.id;
  iconFor(type: string): string {
    return type === 'error' ? '✕' : type === 'success' ? '✓' : 'ℹ';
  }
}

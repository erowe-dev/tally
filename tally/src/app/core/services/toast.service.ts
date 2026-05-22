import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'info' | 'success';
  removing?: boolean;
}

const EXIT_MS = 200;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private _nextId = 0;

  show(message: string, type: Toast['type'] = 'info', durationMs = 4000): void {
    const id = this._nextId++;
    this._toasts.update(ts => [...ts, { id, message, type }]);
    if (durationMs > 0) setTimeout(() => this.dismiss(id), durationMs);
  }

  error(message: string): void { this.show(message, 'error'); }
  success(message: string): void { this.show(message, 'success'); }

  dismiss(id: number): void {
    // Mark removing first so CSS exit animation can play, then remove
    this._toasts.update(ts =>
      ts.map(t => t.id === id ? { ...t, removing: true } : t),
    );
    setTimeout(() => {
      this._toasts.update(ts => ts.filter(t => t.id !== id));
    }, EXIT_MS);
  }
}

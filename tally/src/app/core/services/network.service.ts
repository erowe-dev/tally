import { Injectable, signal } from '@angular/core';

/**
 * Tracks the browser's online/offline status as a signal.
 * Consumed by wallet + expiry services to skip API calls when offline.
 * Also used by AppComponent to show a banner when the connection drops.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private _isOnline = signal(navigator.onLine);
  readonly isOnline = this._isOnline.asReadonly();

  constructor() {
    window.addEventListener('online',  () => this._isOnline.set(true));
    window.addEventListener('offline', () => this._isOnline.set(false));
  }
}

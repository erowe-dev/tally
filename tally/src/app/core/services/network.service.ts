import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/**
 * Tracks the browser's online/offline status as a signal.
 * Consumed by wallet + expiry services to skip API calls when offline.
 * Also used by AppComponent to show a banner when the connection drops.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private browserWindow = isPlatformBrowser(this.platformId) ? this.document.defaultView : null;

  private _isOnline = signal(this.browserWindow?.navigator.onLine ?? true);
  readonly isOnline = this._isOnline.asReadonly();

  constructor() {
    this.browserWindow?.addEventListener('online',  () => this._isOnline.set(true));
    this.browserWindow?.addEventListener('offline', () => this._isOnline.set(false));
  }
}

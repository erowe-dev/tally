import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal, computed, effect } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { retry, switchMap, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from './toast.service';
import { NetworkService } from './network.service';

/**
 * Thin wrapper that bridges Auth0's RxJS observables into Angular signals.
 * This is the ONLY file in the project that uses RxJS directly —
 * all other services and components consume the exposed signals.
 *
 * Also handles first-login user provisioning (creating the DB user row)
 * and exposes `isProvisioned` so other services can safely gate their
 * API calls and avoid racing ahead of the provisioning POST.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth0 = inject(Auth0Service);
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private network = inject(NetworkService);
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private browserWindow = isPlatformBrowser(this.platformId) ? this.document.defaultView : null;

  // Auth0 observables → signals
  readonly isAuthenticated = toSignal(this.auth0.isAuthenticated$, { initialValue: false });
  readonly isLoading = toSignal(this.auth0.isLoading$, { initialValue: true });
  readonly user = toSignal(this.auth0.user$, { initialValue: null });

  // One-shot "Auth0 has finished its async session check". Stays true once
  // flipped — prevents downstream effects from re-firing if Auth0 ever
  // re-emits isLoading:true later (e.g. during token refresh).
  private _hasResolvedOnce = signal(false);
  readonly isResolved = computed(() => this._hasResolvedOnce() || !this.isLoading());

  // True once the DB user row has been provisioned. Other services gate their
  // effect()s on this to avoid racing ahead of POST /api/users/me.
  private _isProvisioned = signal(false);
  readonly isProvisioned = this._isProvisioned.asReadonly();
  private _isProvisioning = signal(false);
  private _provisionAttemptKey = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.isLoading()) this._hasResolvedOnce.set(true);
    }, { allowSignalWrites: true });

    effect(() => {
      if (!this.isAuthenticated()) {
        this._isProvisioned.set(false);
        this._isProvisioning.set(false);
        this._provisionAttemptKey.set(null);
        return;
      }

      if (!this.network.isOnline()) {
        this._isProvisioning.set(false);
        this._provisionAttemptKey.set(null);
        return;
      }

      const user = this.user();
      const userKey = user?.sub ?? user?.email;
      if (!user || !userKey || this._isProvisioned() || this._isProvisioning()) return;

      const attemptKey = String(userKey);
      if (this._provisionAttemptKey() === attemptKey) return;

      this._provisionAttemptKey.set(attemptKey);
      this.provisionCurrentUser(user.email ?? null);
    }, { allowSignalWrites: true });
  }

  login(): void {
    this.auth0.loginWithRedirect();
  }

  logout(): void {
    this.auth0.logout({
      logoutParams: {
        returnTo: this.browserWindow?.location.origin ?? environment.auth0.authorizationParams.redirect_uri,
      },
    });
  }

  private provisionCurrentUser(email: string | null): void {
    this._isProvisioning.set(true);
    this.auth0.getAccessTokenSilently().pipe(
      switchMap(token =>
        this.http.post(
          `${environment.apiUrl}/api/users/me`,
          { email },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ),
      retry({
        count: 3,
        delay: (_err, retryCount) => timer(Math.pow(2, retryCount - 1) * 1000),
      }),
    ).subscribe({
      next: () => {
        this._isProvisioned.set(true);
        this._isProvisioning.set(false);
      },
      error: _err => {
        this._isProvisioning.set(false);
        this.toast.error('Could not connect to server — data saves locally only');
        // Keep isProvisioned=false. When the network signal flips offline→online,
        // the attempt key is cleared and provisioning will retry automatically.
      },
    });
  }
}

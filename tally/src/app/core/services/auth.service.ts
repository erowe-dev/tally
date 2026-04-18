import { Injectable, inject, signal, computed } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { filter, switchMap, take, retry, timer } from 'rxjs';
import { environment } from '../../../environments/environment';

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

  // Auth0 observables → signals
  readonly isAuthenticated = toSignal(this.auth0.isAuthenticated$, { initialValue: false });
  readonly isLoading = toSignal(this.auth0.isLoading$, { initialValue: true });
  readonly user = toSignal(this.auth0.user$, { initialValue: null });

  // One-shot "Auth0 has finished its async session check". Stays true once
  // flipped — prevents downstream effects from re-firing if Auth0 ever
  // re-emits isLoading:true later (e.g. during token refresh).
  private _hasResolvedOnce = signal(false);
  readonly isResolved = computed(() => {
    if (!this.isLoading()) this._hasResolvedOnce.set(true);
    return this._hasResolvedOnce() || !this.isLoading();
  });

  // True once the DB user row has been provisioned. Other services gate their
  // effect()s on this to avoid racing ahead of POST /api/users/me.
  private _isProvisioned = signal(false);
  readonly isProvisioned = this._isProvisioned.asReadonly();

  constructor() {
    // On first login: provision the user row in our database.
    // - `filter(Boolean)` waits for a truthy isAuthenticated$ emission
    // - `take(1)` on both pipes ensures this runs exactly once per session
    // - `retry` with exponential backoff handles transient API/network failures
    //   (cold Render server, brief connectivity blip, etc.)
    this.auth0.isAuthenticated$
      .pipe(
        filter(Boolean),
        take(1),
        switchMap(() => this.auth0.user$),
        filter(u => u != null),
        take(1),
        switchMap(user =>
          this.auth0.getAccessTokenSilently().pipe(
            switchMap(token =>
              this.http.post(
                `${environment.apiUrl}/api/users/me`,
                { email: user!.email },
                { headers: { Authorization: `Bearer ${token}` } },
              ),
            ),
          ),
        ),
        // Up to 3 retries with exponential backoff: 1s, 2s, 4s
        retry({
          count: 3,
          delay: (_err, retryCount) => timer(Math.pow(2, retryCount - 1) * 1000),
        }),
      )
      .subscribe({
        next: () => this._isProvisioned.set(true),
        error: err => {
          console.error('[AuthService] User provisioning failed after 3 retries:', err);
          // Leave isProvisioned=false — other services will stay in
          // localStorage-only mode rather than hitting the API and 404-ing
        },
      });
  }

  login(): void {
    this.auth0.loginWithRedirect();
  }

  logout(): void {
    this.auth0.logout({
      logoutParams: {
        returnTo: environment.auth0.authorizationParams.redirect_uri,
      },
    });
  }
}

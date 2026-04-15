import { Injectable, inject, computed } from '@angular/core';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { filter, switchMap, take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Thin wrapper that bridges Auth0's RxJS observables into Angular signals.
 * This is the ONLY file in the project that uses RxJS directly —
 * all other services and components consume the exposed signals.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private auth0 = inject(Auth0Service);
  private http = inject(HttpClient);

  // Auth0 observables → signals
  readonly isAuthenticated = toSignal(this.auth0.isAuthenticated$, { initialValue: false });
  readonly isLoading = toSignal(this.auth0.isLoading$, { initialValue: true });
  readonly user = toSignal(this.auth0.user$, { initialValue: null });

  // True once Auth0 has finished its async session check
  readonly isResolved = computed(() => !this.isLoading());

  constructor() {
    // On first login: provision the user row in our database.
    // Uses take(1) after the first truthy isAuthenticated$ emission so it only
    // fires once per session, not on every subscription re-evaluation.
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
      )
      .subscribe({
        error: err => console.error('[AuthService] User provision failed:', err),
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

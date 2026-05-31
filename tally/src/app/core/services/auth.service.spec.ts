import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';
import { LocalUserDataService } from './local-user-data.service';

class MockNetworkService {
  isOnline = () => true;
}

describe('AuthService', () => {
  let isAuthenticated$: BehaviorSubject<boolean>;
  let isLoading$: BehaviorSubject<boolean>;
  let user$: BehaviorSubject<{ sub: string; email: string } | null>;
  let auth0: jasmine.SpyObj<Auth0Service>;
  let http: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    isAuthenticated$ = new BehaviorSubject(false);
    isLoading$ = new BehaviorSubject(false);
    user$ = new BehaviorSubject<{ sub: string; email: string } | null>(null);
    auth0 = jasmine.createSpyObj<Auth0Service>('Auth0Service', ['loginWithRedirect', 'logout', 'getAccessTokenSilently'], {
      isAuthenticated$: isAuthenticated$.asObservable(),
      isLoading$: isLoading$.asObservable(),
      user$: user$.asObservable(),
    });
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['post']);
    auth0.getAccessTokenSilently.and.returnValue(of('token'));

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Auth0Service, useValue: auth0 },
        { provide: HttpClient, useValue: http },
        { provide: NetworkService, useClass: MockNetworkService },
        { provide: ToastService, useValue: jasmine.createSpyObj<ToastService>('ToastService', ['error']) },
        { provide: LocalUserDataService, useValue: jasmine.createSpyObj<LocalUserDataService>('LocalUserDataService', ['clearUserData']) },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: document },
      ],
    });
  });

  it('retries provisioning after a transient online failure without a network transition', fakeAsync(() => {
    http.post.and.returnValues(
      throwError(() => new Error('temporary failure')),
      throwError(() => new Error('temporary failure')),
      throwError(() => new Error('temporary failure')),
      throwError(() => new Error('temporary failure')),
      of({}),
    );

    const service = TestBed.inject(AuthService);
    isAuthenticated$.next(true);
    user$.next({ sub: 'auth0|user', email: 'user@example.com' });
    TestBed.flushEffects();

    tick(7_000);
    expect(service.isProvisioned()).toBeFalse();
    expect(http.post).toHaveBeenCalledTimes(4);

    tick(30_000);
    TestBed.flushEffects();

    expect(http.post).toHaveBeenCalledTimes(5);
    expect(service.isProvisioned()).toBeTrue();
  }));
});

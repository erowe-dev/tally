import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { WalletService } from './wallet.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';
import { DataService } from './data.service';

class MockAuthService {
  isResolved = signal(false);
  isAuthenticated = signal(false);
  isProvisioned = signal(false);
}

class MockNetworkService {
  isOnline = signal(true);
}

describe('WalletService', () => {
  const STORAGE_KEY = 'tally_wallet_v1';
  const PENDING_KEY = 'tally_wallet_pending_v1';
  let auth: MockAuthService;
  let network: MockNetworkService;
  let api: jasmine.SpyObj<ApiService>;
  let toast: jasmine.SpyObj<ToastService>;

  function createService(): WalletService {
    return TestBed.inject(WalletService);
  }

  beforeEach(() => {
    localStorage.clear();
    auth = new MockAuthService();
    network = new MockNetworkService();
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getBalancesWithCache',
      'setBalance',
      'cacheBalances',
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        WalletService,
        { provide: AuthService, useValue: auth },
        { provide: ApiService, useValue: api },
        { provide: NetworkService, useValue: network },
        { provide: ToastService, useValue: toast },
        {
          provide: DataService,
          useValue: {
            cards: [
              { id: 'amex_mr', partners: [{ cpp: 2.1 }] },
              { id: 'chase_ur', partners: [{ cpp: 2.0 }] },
            ],
          },
        },
      ],
    });
  });

  it('pushes local balances to the API when the remote wallet is empty', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ amex_mr: 12000 }));
    api.getBalancesWithCache.and.returnValue(of({}));
    api.setBalance.and.returnValue(of({}));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.balances()).toEqual({ amex_mr: 12000 });
    expect(service.syncState()).toBe('synced');
    expect(api.setBalance).toHaveBeenCalledWith('amex_mr', 12000);
  });

  it('uses API balances as source of truth when the remote wallet has data', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ amex_mr: 12000 }));
    api.getBalancesWithCache.and.returnValue(of({ chase_ur: 5000 }));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('synced');
    expect(service.balances()).toEqual({ chase_ur: 5000 });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ chase_ur: 5000 }));
    expect(api.setBalance).not.toHaveBeenCalled();
  });

  it('falls back to cached data and can retry after an API load failure', () => {
    api.getBalancesWithCache.and.returnValues(
      throwError(() => new Error('offline')),
      of({ chase_ur: 5000 }),
    );
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('error');
    expect(toast.error).toHaveBeenCalled();

    service.retryLoad();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('synced');
    expect(service.balances()).toEqual({ chase_ur: 5000 });
    expect(api.getBalancesWithCache).toHaveBeenCalledTimes(2);
  });

  it('merges pending local balance writes over API data and clears them after sync', () => {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ amex_mr: 0 }));
    api.getBalancesWithCache.and.returnValue(of({ amex_mr: 12000, chase_ur: 5000 }));
    api.setBalance.and.returnValue(of({}));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('synced');
    expect(service.balances()).toEqual({ amex_mr: 0, chase_ur: 5000 });
    expect(api.setBalance).toHaveBeenCalledWith('amex_mr', 0);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

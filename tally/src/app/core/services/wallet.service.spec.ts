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
  const HISTORY_KEY = 'tally_wallet_history_v1';
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
    api.getBalancesWithCache.and.returnValue(of({ chase_ur: 5000.4, unknown_program: 9999, amex_mr: -1 }));
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

  it('drops malformed cached balances before using local wallet state', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      amex_mr: 12000.7,
      chase_ur: '5000',
      unknown_program: 8000,
      too_large: 50_000_001,
    }));
    api.getBalancesWithCache.and.returnValue(of({}));
    api.setBalance.and.returnValue(of({}));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.balances()).toEqual({ amex_mr: 12001 });
    expect(api.setBalance).toHaveBeenCalledOnceWith('amex_mr', 12001);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({ amex_mr: 12001 });
  });

  it('clears unreadable local wallet storage on load', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    localStorage.setItem(PENDING_KEY, '{not json');
    localStorage.setItem(HISTORY_KEY, '{not json');

    const service = createService();

    expect(service.balances()).toEqual({});
    expect(service.pendingCount()).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(localStorage.getItem(HISTORY_KEY)).toBeNull();
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
    localStorage.setItem(PENDING_KEY, JSON.stringify({ amex_mr: 0, unknown_program: 5000, chase_ur: -1 }));
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
    expect(service.pendingCount()).toBe(0);
  });

  it('tracks pending balance writes while offline and clears them after a later sync', () => {
    network.isOnline.set(false);
    auth.isProvisioned.set(true);
    const service = createService();

    service.setBalance('amex_mr', 15000);

    expect(service.pendingCount()).toBe(1);
    expect(JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}')).toEqual({ amex_mr: 15000 });

    api.getBalancesWithCache.and.returnValue(of({}));
    api.setBalance.and.returnValue(of({}));
    network.isOnline.set(true);
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    TestBed.flushEffects();

    expect(service.pendingCount()).toBe(0);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('rejects unknown program writes without mutating wallet state', () => {
    const service = createService();

    service.setBalance('unknown_program', 10000);

    expect(service.balances()).toEqual({});
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(api.setBalance).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Unknown program balance was not saved');
  });

  it('combines eligible balances when checking recommendation coverage', () => {
    const service = createService();

    service.setBalance('amex_mr', 30000);
    service.setBalance('chase_ur', 25000);

    expect(service.getCombinedBalance(['amex_mr', 'chase_ur'])).toBe(55000);
    expect(service.canCover(['amex_mr', 'chase_ur'], 50000)).toBeTrue();
    expect(service.canCover(['amex_mr', 'chase_ur'], 60000)).toBeFalse();
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ExpiryService } from './expiry.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';

class MockAuthService {
  isResolved = signal(false);
  isAuthenticated = signal(false);
  isProvisioned = signal(false);
}

class MockNetworkService {
  isOnline = signal(true);
}

describe('ExpiryService', () => {
  const STORAGE_KEY = 'tally_expiry_v1';
  const PENDING_KEY = 'tally_expiry_pending_v1';
  let auth: MockAuthService;
  let network: MockNetworkService;
  let api: jasmine.SpyObj<ApiService>;
  let toast: jasmine.SpyObj<ToastService>;

  function createService(): ExpiryService {
    return TestBed.inject(ExpiryService);
  }

  beforeEach(() => {
    localStorage.clear();
    auth = new MockAuthService();
    network = new MockNetworkService();
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getExpiryRecordsWithCache',
      'setExpiryRecord',
      'deleteExpiryRecord',
      'cacheExpiryRecords',
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        ExpiryService,
        { provide: AuthService, useValue: auth },
        { provide: ApiService, useValue: api },
        { provide: NetworkService, useValue: network },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('pushes local expiry records to the API when the remote state is empty', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' },
    }));
    api.getExpiryRecordsWithCache.and.returnValue(of({}));
    api.setExpiryRecord.and.returnValue(of({}));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('synced');
    expect(api.setExpiryRecord).toHaveBeenCalledWith('citi_ty', '2026-05-18');
  });

  it('uses API expiry records as source of truth when remote data exists', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' },
    }));
    api.getExpiryRecordsWithCache.and.returnValue(of({
      united_mp: { cardId: 'united_mp', lastActivityDate: '2026-04-01' },
    }));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('synced');
    expect(service.records()).toEqual({
      united_mp: { cardId: 'united_mp', lastActivityDate: '2026-04-01' },
    });
    expect(api.setExpiryRecord).not.toHaveBeenCalled();
  });

  it('falls back to cached data and can retry after an API load failure', () => {
    api.getExpiryRecordsWithCache.and.returnValues(
      throwError(() => new Error('offline')),
      of({ citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' } }),
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
    expect(service.records()).toEqual({
      citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' },
    });
    expect(api.getExpiryRecordsWithCache).toHaveBeenCalledTimes(2);
  });

  it('treats invalid persisted dates as needing user attention', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-13-99' },
    }));
    api.getExpiryRecordsWithCache.and.returnValue(of({}));

    const service = createService();
    const status = service.statuses().find(s => s.cardId === 'citi_ty');

    expect(status?.urgency).toBe('warning');
    expect(status?.actionNeeded).toContain('Set your last activity date');
  });

  it('drops malformed cached expiry records before promoting local state', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' },
      mismatched: { cardId: 'hyatt', lastActivityDate: '2026-05-18' },
      unknown_program: { cardId: 'unknown_program', lastActivityDate: '2026-05-18' },
      invalid_date: { cardId: 'aa_aadvantage', lastActivityDate: '2026-13-99' },
      future_date: { cardId: 'hyatt', lastActivityDate: '2999-01-01' },
    }));
    api.getExpiryRecordsWithCache.and.returnValue(of({}));
    api.setExpiryRecord.and.returnValue(of({}));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.records()).toEqual({
      citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' },
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' },
    });
    expect(api.setExpiryRecord).toHaveBeenCalledOnceWith('citi_ty', '2026-05-18');
  });

  it('preserves the calendar day when computing expiry dates from YYYY-MM-DD values', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' },
    }));
    api.getExpiryRecordsWithCache.and.returnValue(of({}));

    const service = createService();
    const status = service.statuses().find(s => s.cardId === 'citi_ty');

    expect(status?.expiryDate?.getFullYear()).toBe(2027);
    expect(status?.expiryDate?.getMonth()).toBe(10);
    expect(status?.expiryDate?.getDate()).toBe(18);
  });

  it('merges pending expiry writes over API data and clears them after sync', () => {
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      upserts: {
        citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' },
        wrong_key: { cardId: 'hyatt', lastActivityDate: '2026-05-18' },
        future_date: { cardId: 'aa_aadvantage', lastActivityDate: '2999-01-01' },
      },
      deletes: ['united_mp', 'unknown_program', 'citi_ty'],
    }));
    api.getExpiryRecordsWithCache.and.returnValue(of({
      united_mp: { cardId: 'united_mp', lastActivityDate: '2026-04-01' },
    }));
    api.setExpiryRecord.and.returnValue(of({}));
    api.deleteExpiryRecord.and.returnValue(of({}));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('synced');
    expect(service.records()).toEqual({
      citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' },
    });
    expect(api.setExpiryRecord).toHaveBeenCalledWith('citi_ty', '2026-05-18');
    expect(api.deleteExpiryRecord).toHaveBeenCalledWith('united_mp');
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(service.pendingCount()).toBe(0);
  });

  it('tracks pending expiry upserts and deletes while offline', () => {
    network.isOnline.set(false);
    auth.isProvisioned.set(true);
    const service = createService();

    service.setLastActivity('citi_ty', '2026-05-18');

    expect(service.pendingCount()).toBe(1);

    service.clearActivity('citi_ty');

    expect(service.pendingCount()).toBe(1);
    expect(JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}')).toEqual({
      upserts: {},
      deletes: ['citi_ty'],
    });
  });
});

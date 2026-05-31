import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchesService } from './searches.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';
import { SavedSearch } from '../models';

class MockAuthService {
  isResolved = signal(false);
  isAuthenticated = signal(false);
  isProvisioned = signal(false);
}

class MockNetworkService {
  isOnline = signal(true);
}

describe('SearchesService', () => {
  const STORAGE_KEY = 'tally_searches_v1';
  const PENDING_KEY = 'tally_searches_pending_v1';
  let api: jasmine.SpyObj<ApiService>;
  let toast: jasmine.SpyObj<ToastService>;

  function createService(): SearchesService {
    return TestBed.inject(SearchesService);
  }

  beforeEach(() => {
    localStorage.clear();
    api = jasmine.createSpyObj<ApiService>('ApiService', [
      'getSavedSearches',
      'createSavedSearch',
      'updateSavedSearch',
      'deleteSavedSearch',
    ]);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        SearchesService,
        { provide: AuthService, useClass: MockAuthService },
        { provide: ApiService, useValue: api },
        { provide: NetworkService, useClass: MockNetworkService },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('persists local saved searches below the cap', () => {
    const service = createService();

    const saved = service.createSearch(searchPayload('Tokyo'));

    expect(saved).not.toBeNull();
    expect(service.searches().length).toBe(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]').length).toBe(1);
    expect(JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}')[saved!.id]).toBeTruthy();
  });

  it('refuses to create more than five saved searches locally', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      Array.from({ length: 5 }, (_, index) => savedSearch(`search_${index}`)),
    ));
    const service = createService();

    const saved = service.createSearch(searchPayload('Paris'));

    expect(saved).toBeNull();
    expect(service.searches().length).toBe(5);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]').length).toBe(5);
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
    expect(api.createSavedSearch).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Delete a saved search before adding another');
  });

  it('drops malformed saved searches and normalizes supported cached records', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        ...savedSearch('valid_search'),
        originAirport: 'ord',
        destinationAirport: 'not-an-airport',
        notes: 'x'.repeat(1200),
        passengers: 1.4,
        lastRunAt: 'not-a-date',
      },
      {
        ...savedSearch('bad_date'),
        dateWindow: { startDate: '2026-06-20', endDate: '2026-06-10', flexibility: 'plus_minus_3' },
      },
      {
        id: 'missing-fields',
        searchType: 'flight',
      },
    ]));

    const service = createService();

    expect(service.searches().length).toBe(1);
    expect(service.searches()[0]).toEqual(jasmine.objectContaining({
      id: 'valid_search',
      originAirport: 'ORD',
      passengers: 1,
    }));
    expect(service.searches()[0].destinationAirport).toBeUndefined();
    expect(service.searches()[0].notes?.length).toBe(1000);
    expect(service.searches()[0].lastRunAt).toBeUndefined();
  });

  it('keeps saved searches without explicit date bounds for flexible planning', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        ...savedSearch('open_dates'),
        dateWindow: { startDate: '', endDate: '', flexibility: 'next_60_days' },
      },
    ]));

    const service = createService();

    expect(service.searches()[0].dateWindow).toEqual({
      startDate: '',
      endDate: '',
      flexibility: 'next_60_days',
    });
  });

  it('normalizes pending searches by their saved id before retrying', () => {
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      stale_key: {
        ...savedSearch('actual_id'),
        originAirport: 'ord',
      },
      invalid_pending: {
        id: 'invalid_pending',
        searchType: 'flight',
      },
    }));

    const service = createService();
    service.createSearch(searchPayload('Seoul'));

    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}');
    expect(pending.actual_id.originAirport).toBe('ORD');
    expect(pending.stale_key).toBeUndefined();
    expect(pending.invalid_pending).toBeUndefined();
  });
});

function searchPayload(destinationText: string): Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    searchType: 'flight',
    originAirport: 'ORD',
    destinationAirport: 'NRT',
    destinationText,
    dateWindow: { startDate: '2026-06-10', endDate: '2026-06-20', flexibility: 'plus_minus_3' },
    cabin: 'business',
    passengers: 1,
  };
}

function savedSearch(id: string): SavedSearch {
  return {
    id,
    ...searchPayload('Tokyo'),
    createdAt: '2026-05-31T00:00:00.000Z',
    updatedAt: '2026-05-31T00:00:00.000Z',
  };
}

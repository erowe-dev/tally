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

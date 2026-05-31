import { signal } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { PreferencesService } from './preferences.service';
import { ToastService } from './toast.service';

class MockAuthService {
  isResolved = signal(true);
  isAuthenticated = signal(false);
  isProvisioned = signal(false);
}

class MockApiService {
  getPreferences = jasmine.createSpy('getPreferences').and.returnValue(of(null));
  savePreferences = jasmine.createSpy('savePreferences').and.callFake(preferences => of(preferences));
}

class MockNetworkService {
  isOnline = signal(true);
}

describe('PreferencesService', () => {
  const STORAGE_KEY = 'tally_preferences_v1';
  const PENDING_KEY = 'tally_preferences_pending_v1';
  let api: MockApiService;

  beforeEach(() => {
    localStorage.clear();
    api = new MockApiService();

    TestBed.configureTestingModule({
      providers: [
        PreferencesService,
        { provide: AuthService, useClass: MockAuthService },
        { provide: ApiService, useValue: api },
        { provide: NetworkService, useClass: MockNetworkService },
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
      ],
    });
  });

  it('loads and sanitizes held program ids from local storage', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      heldProgramIds: ['hyatt', 'hyatt', '', 42, 'unknown_program', 'amex_mr'],
    }));

    const service = TestBed.inject(PreferencesService);

    expect(service.preferences().heldProgramIds).toEqual(['hyatt', 'amex_mr']);
  });

  it('saves held program ids through local storage and API sync', () => {
    const auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);
    const service = TestBed.inject(PreferencesService);

    service.updatePreferences({ heldProgramIds: ['chase_ur', 'chase_ur', 'hyatt'] });

    expect(service.preferences().heldProgramIds).toEqual(['chase_ur', 'hyatt']);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').heldProgramIds).toEqual(['chase_ur', 'hyatt']);
    expect(api.savePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      heldProgramIds: ['chase_ur', 'hyatt'],
    }));
  });

  it('pushes pending offline preferences before accepting stale API state', fakeAsync(() => {
    const localPreferences = {
      homeAirports: ['OMA'],
      preferredCabin: 'business',
      maxStops: 1,
      preferredPrograms: [],
      heldProgramIds: ['hyatt'],
      hotelChains: [],
      defaultTravelers: 1,
      dateFlexibility: 'plus_minus_3',
      pointValuationCpp: 1.6,
      updatedAt: '2026-05-31T07:00:00.000Z',
    };
    const staleApiPreferences = {
      ...localPreferences,
      heldProgramIds: ['amex_mr'],
      updatedAt: '2026-05-30T07:00:00.000Z',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(localPreferences));
    localStorage.setItem(PENDING_KEY, JSON.stringify(localPreferences));
    api.getPreferences.and.returnValue(of(staleApiPreferences));

    const auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);
    const service = TestBed.inject(PreferencesService);
    tick();

    expect(service.preferences().heldProgramIds).toEqual(['hyatt']);
    expect(api.savePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      heldProgramIds: ['hyatt'],
    }));
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  }));

  it('keeps offline updates pending and syncs them on reconnect', fakeAsync(() => {
    const auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    const network = TestBed.inject(NetworkService) as unknown as MockNetworkService;
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);
    network.isOnline.set(false);
    const service = TestBed.inject(PreferencesService);

    service.updatePreferences({ heldProgramIds: ['bilt'] });

    expect(api.savePreferences).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}').heldProgramIds).toEqual(['bilt']);

    network.isOnline.set(true);
    service.retryLoad();
    tick();

    expect(api.savePreferences).toHaveBeenCalledWith(jasmine.objectContaining({
      heldProgramIds: ['bilt'],
    }));
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  }));
});

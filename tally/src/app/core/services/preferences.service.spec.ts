import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
      heldProgramIds: ['hyatt', 'hyatt', '', 42, 'amex_mr'],
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
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TripsService } from './trips.service';
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

describe('TripsService', () => {
  const STORAGE_KEY = 'tally_trips_v1';
  let auth: MockAuthService;
  let network: MockNetworkService;
  let api: jasmine.SpyObj<ApiService>;
  let toast: jasmine.SpyObj<ToastService>;

  function createService(): TripsService {
    return TestBed.inject(TripsService);
  }

  beforeEach(() => {
    localStorage.clear();
    auth = new MockAuthService();
    network = new MockNetworkService();
    api = jasmine.createSpyObj<ApiService>('ApiService', ['getTrips', 'createTrip', 'updateTripNotes', 'deleteTrip']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        TripsService,
        { provide: AuthService, useValue: auth },
        { provide: ApiService, useValue: api },
        { provide: NetworkService, useValue: network },
        { provide: ToastService, useValue: toast },
      ],
    });
  });

  it('promotes cached local trips when the API is empty', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        id: 'local_1',
        tripType: 'flight',
        origin: 'ORD',
        destination: 'LHR',
        cabin: 'business',
        passengers: 1,
        programName: 'Virgin Atlantic Flying Club',
        ptsRequired: 50000,
        createdAt: '2026-05-18T00:00:00.000Z',
      },
    ]));
    api.getTrips.and.returnValue(of([]));
    api.createTrip.and.returnValue(of({
      id: 'server_1',
      tripType: 'flight',
      origin: 'ORD',
      destination: 'LHR',
      cabin: 'business',
      passengers: 1,
      programName: 'Virgin Atlantic Flying Club',
      ptsRequired: 50000,
      createdAt: '2026-05-18T00:00:00.000Z',
    }));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('synced');
    expect(api.createTrip).toHaveBeenCalled();
    expect(service.trips().length).toBe(1);
  });

  it('uses API trips as source of truth when remote trips exist', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        id: 'local_1',
        tripType: 'hotel',
        destination: 'Tokyo',
        hotelCat: 'mid',
        nights: 3,
        programName: 'World of Hyatt',
        ptsRequired: 45000,
        createdAt: '2026-05-18T00:00:00.000Z',
      },
    ]));
    api.getTrips.and.returnValue(of([
      {
        id: 'server_1',
        tripType: 'flight',
        origin: 'ORD',
        destination: 'LHR',
        cabin: 'business',
        passengers: 1,
        programName: 'Virgin Atlantic Flying Club',
        ptsRequired: 50000,
        createdAt: '2026-05-18T00:00:00.000Z',
      },
    ]));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('synced');
    expect(service.trips()[0].id).toBe('server_1');
    expect(api.createTrip).not.toHaveBeenCalled();
  });

  it('keeps optimistic local trips when offline without calling the API', () => {
    network.isOnline.set(false);
    const service = createService();

    service.saveTrip({
      tripType: 'hotel',
      destination: 'Tokyo',
      hotelCat: 'mid',
      nights: 3,
      programName: 'World of Hyatt',
      ptsRequired: 45000,
    });

    expect(service.trips()[0].id.startsWith('local_')).toBeTrue();
    expect(api.createTrip).not.toHaveBeenCalled();
  });

  it('retries loading after an API failure', () => {
    api.getTrips.and.returnValues(
      throwError(() => new Error('network')),
      of([]),
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
    expect(api.getTrips).toHaveBeenCalledTimes(2);
  });
});

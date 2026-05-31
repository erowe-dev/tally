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
  const PENDING_KEY = 'tally_trips_pending_v1';
  const DELETED_KEY = 'tally_trips_deleted_v1';
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

  it('keeps and promotes local-only trips when remote trips exist', () => {
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
    api.createTrip.and.returnValue(of({
      id: 'server_2',
      tripType: 'hotel',
      destination: 'Tokyo',
      hotelCat: 'mid',
      nights: 3,
      programName: 'World of Hyatt',
      ptsRequired: 45000,
      createdAt: '2026-05-18T00:00:00.000Z',
    }));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.syncState()).toBe('synced');
    expect(service.trips().some(trip => trip.id === 'server_1')).toBeTrue();
    expect(api.createTrip).toHaveBeenCalled();
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
    expect(service.localOnlyCount()).toBe(1);
    expect(api.createTrip).not.toHaveBeenCalled();
  });

  it('drops malformed trips and normalizes supported cached records', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        id: 'valid_trip',
        tripType: 'flight',
        origin: 'ord',
        destination: 'Tokyo',
        cabin: 'business',
        passengers: 1.4,
        programName: '  Air Canada Aeroplan  ',
        ptsRequired: 75000.4,
        notes: 'x'.repeat(600),
        createdAt: '2026-05-18T00:00:00.000Z',
      },
      {
        id: 'too_many_points',
        tripType: 'hotel',
        destination: 'Tokyo',
        programName: 'World of Hyatt',
        ptsRequired: 5_000_001,
        createdAt: '2026-05-18T00:00:00.000Z',
      },
      {
        id: 'missing-program',
        tripType: 'flight',
        ptsRequired: 50000,
        createdAt: '2026-05-18T00:00:00.000Z',
      },
    ]));

    const service = createService();

    expect(service.trips().length).toBe(1);
    expect(service.trips()[0]).toEqual(jasmine.objectContaining({
      id: 'valid_trip',
      origin: 'ORD',
      programName: 'Air Canada Aeroplan',
      ptsRequired: 75000,
      passengers: 1,
    }));
    expect(service.trips()[0].destination).toBeUndefined();
    expect(service.trips()[0].notes?.length).toBe(500);
  });

  it('normalizes pending trips by their saved id before retrying', () => {
    auth.isProvisioned.set(true);
    network.isOnline.set(false);
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      stale_key: {
        id: 'actual_id',
        tripType: 'hotel',
        destination: '  Tokyo  ',
        nights: 3.2,
        hotelCat: 'mid',
        programName: 'World of Hyatt',
        ptsRequired: 45000,
        createdAt: '2026-05-18T00:00:00.000Z',
      },
      invalid_pending: {
        id: 'invalid_pending',
        tripType: 'flight',
      },
    }));
    const service = createService();

    service.saveTrip({
      tripType: 'hotel',
      destination: 'Seoul',
      hotelCat: 'mid',
      nights: 3,
      programName: 'World of Hyatt',
      ptsRequired: 45000,
    });

    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '{}');
    expect(pending.actual_id.destination).toBe('Tokyo');
    expect(pending.actual_id.nights).toBe(3);
    expect(pending.stale_key).toBeUndefined();
    expect(pending.invalid_pending).toBeUndefined();
  });

  it('updates the local-only count when a temporary trip is promoted', () => {
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

    expect(service.localOnlyCount()).toBe(0);
    expect(service.trips()[0].id).toBe('server_1');
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

  it('replays offline note edits before accepting stale API trips', () => {
    const localEditedTrip = {
      id: 'server_1',
      tripType: 'flight' as const,
      origin: 'ORD',
      destination: 'LHR',
      cabin: 'business' as const,
      passengers: 1,
      programName: 'Virgin Atlantic Flying Club',
      ptsRequired: 50000,
      notes: 'offline edit',
      createdAt: '2026-05-18T00:00:00.000Z',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([localEditedTrip]));
    localStorage.setItem(PENDING_KEY, JSON.stringify({ server_1: localEditedTrip }));
    api.getTrips.and.returnValue(of([{ ...localEditedTrip, notes: 'stale server note' }]));
    api.updateTripNotes.and.returnValue(of({}));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.trips()[0].notes).toBe('offline edit');
    expect(api.updateTripNotes).toHaveBeenCalledWith('server_1', 'offline edit');
    expect(localStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it('replays offline deletes and keeps deleted trips from resurrecting', () => {
    const serverTrip = {
      id: 'server_1',
      tripType: 'hotel' as const,
      destination: 'Tokyo',
      hotelCat: 'mid' as const,
      nights: 3,
      programName: 'World of Hyatt',
      ptsRequired: 45000,
      createdAt: '2026-05-18T00:00:00.000Z',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    localStorage.setItem(DELETED_KEY, JSON.stringify(['server_1']));
    api.getTrips.and.returnValue(of([serverTrip]));
    api.deleteTrip.and.returnValue(of({}));
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);

    const service = createService();
    TestBed.flushEffects();

    expect(service.trips()).toEqual([]);
    expect(api.deleteTrip).toHaveBeenCalledWith('server_1');
    expect(localStorage.getItem(DELETED_KEY)).toBeNull();
  });

  it('queues offline clear-all deletes for real server trips', () => {
    const serverTrip = {
      id: 'server_1',
      tripType: 'flight' as const,
      origin: 'ORD',
      destination: 'LHR',
      cabin: 'business' as const,
      passengers: 1,
      programName: 'Virgin Atlantic Flying Club',
      ptsRequired: 50000,
      createdAt: '2026-05-18T00:00:00.000Z',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([serverTrip]));
    network.isOnline.set(false);
    auth.isResolved.set(true);
    auth.isAuthenticated.set(true);
    auth.isProvisioned.set(true);
    const service = createService();

    service.clearAll();

    expect(service.trips()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(DELETED_KEY) ?? '[]')).toEqual(['server_1']);
    expect(api.deleteTrip).not.toHaveBeenCalled();

    api.getTrips.and.returnValue(of([serverTrip]));
    api.deleteTrip.and.returnValue(of({}));
    network.isOnline.set(true);
    service.retryLoad();
    TestBed.flushEffects();

    expect(api.deleteTrip).toHaveBeenCalledWith('server_1');
    expect(localStorage.getItem(DELETED_KEY)).toBeNull();
  });
});

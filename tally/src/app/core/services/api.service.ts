import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { Observable, catchError, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AwardAvailabilityResult,
  CabinClass,
  DateWindow,
  HotelFitRequest,
  HotelFitResult,
  HotelSearchIntent,
  ProviderCacheStatus,
  SavedTrip,
  SavedSearch,
  UserPreference,
} from '../models';
import { AuthService } from './auth.service';

export interface ApiExpiryRecord {
  cardId: string;
  lastActivityDate: string;
}

export interface ProviderSearchResponse<T> {
  provider: string;
  cacheStatus: ProviderCacheStatus;
  lastChecked: string;
  stale: boolean;
  source: string;
  dataMode: 'planning_estimate';
  availabilitySource: 'estimated_not_live';
  isLive: false;
  notice: string;
  results: T[];
}

export interface AwardAvailabilityRequest {
  originAirport: string;
  destinationAirport: string;
  startDate: string;
  endDate: string;
  cabin: CabinClass;
  passengers: number;
}

interface CacheEnvelope<T> {
  savedAt: number;
  data: T;
}

const CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const BALANCES_CACHE_KEY = 'tally_cache_balances';
const EXPIRY_CACHE_KEY = 'tally_cache_expiry';
const MAX_BALANCE = 50_000_000;
const KNOWN_PROGRAM_IDS = new Set([
  'amex_mr',
  'chase_ur',
  'citi_ty',
  'cap1_miles',
  'bilt',
  'delta_skymiles',
  'united_mp',
  'aa_aadvantage',
  'southwest_rr',
  'alaska_mp',
  'marriott_bonvoy',
  'hyatt',
  'hilton_honors',
  'ihg_rewards',
]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Centralises all authenticated HTTP calls to the Tally Express API.
 * Every method attaches the Auth0 access token automatically via withAuth().
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private auth0 = inject(Auth0Service);
  private auth = inject(AuthService);

  // Wraps any HTTP call with a fresh Auth0 access token
  private withAuth<T>(call: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    return this.auth0.getAccessTokenSilently().pipe(
      switchMap(token =>
        call(new HttpHeaders({ Authorization: `Bearer ${token}` })),
      ),
    );
  }

  private withProvisionedAuth<T>(call: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    if (!this.auth.isProvisioned()) {
      return throwError(() => new Error('User not provisioned'));
    }
    return this.withAuth(call);
  }

  // ── Balances ────────────────────────────────────────────────────────────────

  getBalances(): Observable<Record<string, number>> {
    return this.withProvisionedAuth(headers =>
      this.http.get<Record<string, number>>(
        `${environment.apiUrl}/api/balances`,
        { headers },
      ),
    );
  }

  getBalancesWithCache(): Observable<Record<string, number>> {
    return this.getBalances().pipe(
      tap(balances => this.writeCache(BALANCES_CACHE_KEY, balances)),
      catchError(error => {
        const cached = this.readCache<Record<string, number>>(BALANCES_CACHE_KEY, isBalanceMap);
        return cached ? of(cached) : throwError(() => error);
      }),
    );
  }

  cacheBalances(balances: Record<string, number>): void {
    this.writeCache(BALANCES_CACHE_KEY, balances);
  }

  setBalance(cardId: string, amount: number): Observable<unknown> {
    return this.withProvisionedAuth(headers =>
      this.http.put(
        `${environment.apiUrl}/api/balances/${cardId}`,
        { amount },
        { headers },
      ),
    );
  }

  // ── Expiry records ──────────────────────────────────────────────────────────

  getExpiryRecords(): Observable<Record<string, ApiExpiryRecord>> {
    return this.withProvisionedAuth(headers =>
      this.http.get<Record<string, ApiExpiryRecord>>(
        `${environment.apiUrl}/api/expiry`,
        { headers },
      ),
    );
  }

  getExpiryRecordsWithCache(): Observable<Record<string, ApiExpiryRecord>> {
    return this.getExpiryRecords().pipe(
      tap(records => this.writeCache(EXPIRY_CACHE_KEY, records)),
      catchError(error => {
        const cached = this.readCache<Record<string, ApiExpiryRecord>>(EXPIRY_CACHE_KEY, isExpiryRecordMap);
        return cached ? of(cached) : throwError(() => error);
      }),
    );
  }

  cacheExpiryRecords(records: Record<string, ApiExpiryRecord>): void {
    this.writeCache(EXPIRY_CACHE_KEY, records);
  }

  setExpiryRecord(cardId: string, lastActivityDate: string): Observable<unknown> {
    return this.withProvisionedAuth(headers =>
      this.http.put(
        `${environment.apiUrl}/api/expiry/${cardId}`,
        { lastActivityDate },
        { headers },
      ),
    );
  }

  deleteExpiryRecord(cardId: string): Observable<unknown> {
    return this.withProvisionedAuth(headers =>
      this.http.delete(
        `${environment.apiUrl}/api/expiry/${cardId}`,
        { headers },
      ),
    );
  }

  // ── Trips ───────────────────────────────────────────────────────────────────

  getTrips(): Observable<SavedTrip[]> {
    return this.withProvisionedAuth(headers =>
      this.http.get<SavedTrip[]>(`${environment.apiUrl}/api/trips`, { headers }),
    );
  }

  createTrip(trip: Omit<SavedTrip, 'id' | 'createdAt'>): Observable<SavedTrip> {
    return this.withProvisionedAuth(headers =>
      this.http.post<SavedTrip>(`${environment.apiUrl}/api/trips`, trip, { headers }),
    );
  }

  deleteTrip(id: string): Observable<unknown> {
    return this.withProvisionedAuth(headers =>
      this.http.delete(`${environment.apiUrl}/api/trips/${id}`, { headers }),
    );
  }

  updateTripNotes(id: string, notes: string): Observable<unknown> {
    return this.withProvisionedAuth(headers =>
      this.http.patch(`${environment.apiUrl}/api/trips/${id}`, { notes }, { headers }),
    );
  }

  // ── Preferences ────────────────────────────────────────────────────────────

  getPreferences(): Observable<UserPreference | null> {
    return this.withProvisionedAuth(headers =>
      this.http.get<UserPreference | null>(`${environment.apiUrl}/api/preferences`, { headers }),
    );
  }

  savePreferences(preferences: UserPreference): Observable<UserPreference> {
    return this.withProvisionedAuth(headers =>
      this.http.put<UserPreference>(`${environment.apiUrl}/api/preferences`, preferences, { headers }),
    );
  }

  // ── Saved searches ─────────────────────────────────────────────────────────

  getSavedSearches(): Observable<SavedSearch[]> {
    return this.withProvisionedAuth(headers =>
      this.http.get<SavedSearch[]>(`${environment.apiUrl}/api/searches`, { headers }),
    );
  }

  createSavedSearch(search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>): Observable<SavedSearch> {
    return this.withProvisionedAuth(headers =>
      this.http.post<SavedSearch>(`${environment.apiUrl}/api/searches`, search, { headers }),
    );
  }

  updateSavedSearch(id: string, changes: Partial<Omit<SavedSearch, 'id' | 'createdAt'>>): Observable<SavedSearch> {
    return this.withProvisionedAuth(headers =>
      this.http.put<SavedSearch>(`${environment.apiUrl}/api/searches/${id}`, changes, { headers }),
    );
  }

  deleteSavedSearch(id: string): Observable<unknown> {
    return this.withProvisionedAuth(headers =>
      this.http.delete(`${environment.apiUrl}/api/searches/${id}`, { headers }),
    );
  }

  // ── Provider-backed search ─────────────────────────────────────────────────

  searchAwardAvailability(request: AwardAvailabilityRequest): Observable<ProviderSearchResponse<AwardAvailabilityResult>> {
    return this.withProvisionedAuth(headers =>
      this.http.post<ProviderSearchResponse<AwardAvailabilityResult>>(
        `${environment.apiUrl}/api/search/award-availability`,
        request,
        { headers },
      ),
    );
  }

  searchHotelFit(intent: HotelSearchIntent): Observable<ProviderSearchResponse<HotelFitResult>> {
    const request = toHotelFitRequest(intent);
    return this.withProvisionedAuth(headers =>
      this.http.post<ProviderSearchResponse<HotelFitResult>>(
        `${environment.apiUrl}/api/search/hotel-fit`,
        request,
        { headers },
      ),
    );
  }

  private writeCache<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data } satisfies CacheEnvelope<T>));
    } catch {}
  }

  private readCache<T>(key: string, validate: (value: unknown) => value is T): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
      if (
        typeof parsed.savedAt !== 'number' ||
        Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS ||
        !validate(parsed.data)
      ) {
        return null;
      }

      return parsed.data;
    } catch {
      return null;
    }
  }
}

function toHotelFitRequest(intent: HotelSearchIntent): HotelFitRequest {
  return {
    destination: intent.destination,
    hotelCategory: intent.hotelCategory,
    travelers: intent.travelers,
    rooms: intent.rooms,
    nights: intent.nights ?? deriveNights(intent.checkInDate, intent.checkOutDate) ?? 1,
    chains: intent.preferredChains,
    dateWindow: toDateWindow(intent),
  };
}

function toDateWindow(intent: HotelSearchIntent): DateWindow | undefined {
  if (!intent.checkInDate && !intent.checkOutDate) return undefined;
  return {
    startDate: intent.checkInDate ?? '',
    endDate: intent.checkOutDate ?? '',
    flexibility: 'plus_minus_7',
  };
}

function deriveNights(checkInDate: string | undefined, checkOutDate: string | undefined): number | null {
  if (!checkInDate || !checkOutDate) return null;
  const start = Date.parse(`${checkInDate}T00:00:00.000Z`);
  const end = Date.parse(`${checkOutDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.min(30, Math.max(1, Math.round((end - start) / 86_400_000)));
}

function isBalanceMap(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([cardId, amount]) =>
    KNOWN_PROGRAM_IDS.has(cardId) &&
    typeof amount === 'number' &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    amount <= MAX_BALANCE,
  );
}

function isExpiryRecordMap(value: unknown): value is Record<string, ApiExpiryRecord> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([cardId, record]) =>
    !!record &&
    typeof record === 'object' &&
    !Array.isArray(record) &&
    (record as ApiExpiryRecord).cardId === cardId &&
    KNOWN_PROGRAM_IDS.has(cardId) &&
    typeof (record as ApiExpiryRecord).lastActivityDate === 'string' &&
    isValidPastOrTodayDateString((record as ApiExpiryRecord).lastActivityDate),
  );
}

function isValidPastOrTodayDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return date.getTime() <= startOfToday.getTime();
}

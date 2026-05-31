import { Injectable, effect, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';
import { CabinClass, DateFlexibility, UserPreference } from '../models';

const STORAGE_KEY = 'tally_preferences_v1';
const PENDING_KEY = 'tally_preferences_pending_v1';
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
const DEFAULT_PREFERENCES: UserPreference = {
  homeAirports: ['OMA'],
  preferredCabin: 'business',
  maxStops: 1,
  preferredPrograms: [],
  heldProgramIds: [],
  hotelChains: [],
  defaultTravelers: 1,
  dateFlexibility: 'plus_minus_3',
  pointValuationCpp: 1.6,
};

export type PreferenceSyncState = 'idle' | 'loading' | 'synced' | 'error';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private network = inject(NetworkService);
  private toast = inject(ToastService);

  private _preferences = signal<UserPreference>(this.loadLocal());
  private _syncState = signal<PreferenceSyncState>('idle');
  private _retryTrigger = signal(0);
  private _apiLoaded = false;

  readonly preferences = this._preferences.asReadonly();
  readonly syncState = this._syncState.asReadonly();

  constructor() {
    effect(() => {
      this._retryTrigger();
      if (
        !this._apiLoaded &&
        this.auth.isResolved() &&
        this.auth.isAuthenticated() &&
        this.auth.isProvisioned() &&
        this.network.isOnline()
      ) {
        this._apiLoaded = true;
        this._syncState.set('loading');

        this.api.getPreferences().subscribe({
          next: apiPreferences => {
            const localPreferences = this.loadLocal();
            const pendingPreferences = this.loadPending();

            if (pendingPreferences) {
              this._preferences.set(pendingPreferences);
              this.saveLocal(pendingPreferences);
              this._syncState.set('synced');
              this.pushPreferences(pendingPreferences);
              return;
            }

            if (!apiPreferences && this.hasLocalPreferenceData(localPreferences)) {
              this._preferences.set(localPreferences);
              this._syncState.set('synced');
              this.pushPreferences(localPreferences);
              return;
            }

            if (apiPreferences && this.isLocalNewer(localPreferences, apiPreferences)) {
              this._preferences.set(localPreferences);
              this.saveLocal(localPreferences);
              this._syncState.set('synced');
              this.pushPreferences(localPreferences);
              return;
            }

            const nextPreferences = apiPreferences ?? localPreferences;
            this._preferences.set(nextPreferences);
            this.saveLocal(nextPreferences);
            this.clearPending();
            this._syncState.set('synced');
          },
          error: _err => {
            this.toast.error('Could not load preferences — using cached data');
            this._syncState.set('error');
            this._apiLoaded = false;
          },
        });
      }
    }, { allowSignalWrites: true });
  }

  retryLoad(): void {
    this._apiLoaded = false;
    this._syncState.set('idle');
    this._retryTrigger.update(n => n + 1);
  }

  updatePreferences(changes: Partial<UserPreference>): void {
    const updated = sanitizePreferences({
      ...this._preferences(),
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    this._preferences.set(updated);
    this.saveLocal(updated);

    if (this.auth.isProvisioned()) {
      this.savePending(updated);
    }

    if (this.auth.isProvisioned() && this.network.isOnline()) {
      this.pushPreferences(updated);
    } else if (this.auth.isProvisioned()) {
      this.markForRetry();
    }
  }

  private pushPreferences(preferences: UserPreference): void {
    if (!this.auth.isProvisioned()) return;
    this.savePending(preferences);

    if (!this.network.isOnline()) {
      this.markForRetry();
      return;
    }

    this.api.savePreferences(preferences).subscribe({
      next: saved => {
        this._preferences.set(saved);
        this.saveLocal(saved);
        this.clearPending();
        this._syncState.set('synced');
      },
      error: _err => this.markForRetry('Preferences not saved — will retry when online'),
    });
  }

  private markForRetry(message?: string): void {
    this._apiLoaded = false;
    this._syncState.set('error');
    if (message) this.toast.error(message);
  }

  private loadLocal(): UserPreference {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? sanitizePreferences(JSON.parse(raw) as Partial<UserPreference>) : { ...DEFAULT_PREFERENCES };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  private saveLocal(preferences: UserPreference): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {}
  }

  private loadPending(): UserPreference | null {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return raw ? sanitizePreferences(JSON.parse(raw) as Partial<UserPreference>) : null;
    } catch {
      return null;
    }
  }

  private savePending(preferences: UserPreference): void {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(preferences));
    } catch {}
  }

  private clearPending(): void {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {}
  }

  private hasLocalPreferenceData(preferences: UserPreference): boolean {
    return JSON.stringify({ ...preferences, updatedAt: undefined }) !==
      JSON.stringify({ ...DEFAULT_PREFERENCES, updatedAt: undefined });
  }

  private isLocalNewer(localPreferences: UserPreference, apiPreferences: UserPreference): boolean {
    if (!this.hasLocalPreferenceData(localPreferences)) return false;
    if (!localPreferences.updatedAt) return false;
    if (!apiPreferences.updatedAt) return true;
    return Date.parse(localPreferences.updatedAt) > Date.parse(apiPreferences.updatedAt);
  }
}

function sanitizePreferences(value: Partial<UserPreference>): UserPreference {
  return {
    homeAirports: stringArray(value.homeAirports).map(code => code.toUpperCase()).slice(0, 5),
    preferredCabin: isCabinClass(value.preferredCabin) ? value.preferredCabin : DEFAULT_PREFERENCES.preferredCabin,
    maxStops: value.maxStops === 0 || value.maxStops === 1 || value.maxStops === 2
      ? value.maxStops
      : DEFAULT_PREFERENCES.maxStops,
    preferredPrograms: uniqueStringArray(value.preferredPrograms).slice(0, 20),
    heldProgramIds: uniqueStringArray(value.heldProgramIds).filter(id => KNOWN_PROGRAM_IDS.has(id)),
    hotelChains: uniqueStringArray(value.hotelChains).slice(0, 20),
    defaultTravelers: clampInteger(value.defaultTravelers, 1, 9, DEFAULT_PREFERENCES.defaultTravelers),
    dateFlexibility: isDateFlexibility(value.dateFlexibility) ? value.dateFlexibility : DEFAULT_PREFERENCES.dateFlexibility,
    pointValuationCpp: clampNumber(value.pointValuationCpp, 0.1, 10, DEFAULT_PREFERENCES.pointValuationCpp),
    updatedAt: value.updatedAt,
  };
}

function isCabinClass(value: unknown): value is CabinClass {
  return value === 'economy' || value === 'premium' || value === 'business' || value === 'first';
}

function isDateFlexibility(value: unknown): value is DateFlexibility {
  return value === 'exact' || value === 'plus_minus_3' || value === 'plus_minus_7' || value === 'month' || value === 'next_60_days';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
    : [];
}

function uniqueStringArray(value: unknown): string[] {
  return [...new Set(stringArray(value))];
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

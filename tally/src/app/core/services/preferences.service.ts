import { Injectable, effect, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';
import { CabinClass, DateFlexibility, UserPreference } from '../models';

const STORAGE_KEY = 'tally_preferences_v1';
const DEFAULT_PREFERENCES: UserPreference = {
  homeAirports: ['OMA'],
  preferredCabin: 'business',
  maxStops: 1,
  preferredPrograms: [],
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
            if (!apiPreferences && this.hasLocalPreferenceData(localPreferences)) {
              this._preferences.set(localPreferences);
              this._syncState.set('synced');
              this.pushPreferences(localPreferences);
              return;
            }

            const nextPreferences = apiPreferences ?? localPreferences;
            this._preferences.set(nextPreferences);
            this.saveLocal(nextPreferences);
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

    if (this.auth.isProvisioned() && this.network.isOnline()) {
      this.pushPreferences(updated);
    } else if (this.auth.isProvisioned()) {
      this.markForRetry();
    }
  }

  private pushPreferences(preferences: UserPreference): void {
    this.api.savePreferences(preferences).subscribe({
      next: saved => {
        this._preferences.set(saved);
        this.saveLocal(saved);
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

  private hasLocalPreferenceData(preferences: UserPreference): boolean {
    return JSON.stringify({ ...preferences, updatedAt: undefined }) !==
      JSON.stringify({ ...DEFAULT_PREFERENCES, updatedAt: undefined });
  }
}

function sanitizePreferences(value: Partial<UserPreference>): UserPreference {
  return {
    homeAirports: stringArray(value.homeAirports).map(code => code.toUpperCase()).slice(0, 5),
    preferredCabin: isCabinClass(value.preferredCabin) ? value.preferredCabin : DEFAULT_PREFERENCES.preferredCabin,
    maxStops: value.maxStops === 0 || value.maxStops === 1 || value.maxStops === 2
      ? value.maxStops
      : DEFAULT_PREFERENCES.maxStops,
    preferredPrograms: stringArray(value.preferredPrograms).slice(0, 20),
    hotelChains: stringArray(value.hotelChains).slice(0, 20),
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

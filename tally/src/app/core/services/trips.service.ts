import { Injectable, signal, inject, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';
import { SavedTrip } from '../models';

const STORAGE_KEY = 'tally_trips_v1';

@Injectable({ providedIn: 'root' })
export class TripsService {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private network = inject(NetworkService);

  private _trips = signal<SavedTrip[]>(this.loadLocal());
  private _apiLoaded = false;

  readonly trips = this._trips.asReadonly();

  constructor() {
    effect(() => {
      if (
        !this._apiLoaded &&
        this.auth.isResolved() &&
        this.auth.isAuthenticated() &&
        this.auth.isProvisioned() &&
        this.network.isOnline()
      ) {
        this._apiLoaded = true;
        this.api.getTrips().subscribe({
          next: trips => {
            this._trips.set(trips);
            this.saveLocal(trips);
          },
          error: err => {
            console.error('[TripsService] API load failed, using localStorage cache:', err);
            this._apiLoaded = false;
          },
        });
      }
    });
  }

  saveTrip(trip: Omit<SavedTrip, 'id' | 'createdAt'>): void {
    // Optimistic local insert with a temp id
    const tempId = `local_${Date.now()}`;
    const optimistic: SavedTrip = {
      ...trip,
      id: tempId,
      createdAt: new Date().toISOString(),
    };
    const updated = [optimistic, ...this._trips()];
    this._trips.set(updated);
    this.saveLocal(updated);

    if (this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.createTrip(trip).subscribe({
        next: saved => {
          // Replace temp entry with the real API response (gets a real id + createdAt)
          const current = this._trips().map(t => t.id === tempId ? saved : t);
          this._trips.set(current);
          this.saveLocal(current);
        },
        error: err => console.error('[TripsService] API save failed:', err),
      });
    }
  }

  deleteTrip(id: string): void {
    const updated = this._trips().filter(t => t.id !== id);
    this._trips.set(updated);
    this.saveLocal(updated);

    // Only hit the API for real (non-temp) ids
    if (!id.startsWith('local_') && this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.deleteTrip(id).subscribe({
        error: err => console.error('[TripsService] API delete failed:', err),
      });
    }
  }

  private loadLocal(): SavedTrip[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SavedTrip[]) : [];
    } catch {
      return [];
    }
  }

  private saveLocal(trips: SavedTrip[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    } catch {}
  }
}

import { Injectable, signal, inject, effect, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';
import { SavedTrip } from '../models';

const STORAGE_KEY = 'tally_trips_v1';
export type SyncState = 'idle' | 'loading' | 'synced' | 'error';

@Injectable({ providedIn: 'root' })
export class TripsService {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private network = inject(NetworkService);
  private toast = inject(ToastService);

  private _trips = signal<SavedTrip[]>(this.loadLocal());
  private _syncState = signal<SyncState>('idle');
  private _retryTrigger = signal(0);
  private _apiLoaded = false;
  private deletedLocalIds = new Set<string>();

  readonly trips = this._trips.asReadonly();
  readonly syncState = this._syncState.asReadonly();
  readonly localOnlyCount = computed(() => this._trips().filter(t => t.id.startsWith('local_')).length);

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
        this.api.getTrips().subscribe({
          next: trips => {
            const localTrips = this.loadLocal();
            const localHasData = localTrips.length > 0;
            const apiIsEmpty = trips.length === 0;
            const localOnlyTrips = localTrips.filter(t => t.id.startsWith('local_'));

            if (localOnlyTrips.length > 0) {
              const merged = [
                ...localOnlyTrips,
                ...trips.filter(apiTrip => !localTrips.some(localTrip => localTrip.id === apiTrip.id)),
              ];
              this._trips.set(merged);
              this.saveLocal(merged);
              this._syncState.set('synced');
              this.pushLocalToApi(localOnlyTrips);
            } else if (apiIsEmpty && localHasData) {
              this._trips.set(localTrips);
              this._syncState.set('synced');
              this.pushLocalToApi(localTrips);
            } else {
              this._trips.set(trips);
              this.saveLocal(trips);
              this._syncState.set('synced');
            }
          },
          error: _err => {
            this.toast.error('Could not load saved trips — using cached data');
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
          if (this.deletedLocalIds.has(tempId)) {
            this.deletedLocalIds.delete(tempId);
            this.api.deleteTrip(saved.id).subscribe({
              error: _err => this.markForRetry('Trip could not be deleted from server'),
            });
            return;
          }

          const optimistic = this._trips().find(t => t.id === tempId);
          const savedWithLocalEdits = optimistic ? { ...saved, notes: optimistic.notes } : saved;
          const current = this._trips().map(t => t.id === tempId ? savedWithLocalEdits : t);
          this._trips.set(current);
          this.saveLocal(current);

          if (optimistic?.notes !== trip.notes) {
            this.api.updateTripNotes(saved.id, optimistic?.notes ?? '').subscribe({
              error: _err => this.markForRetry('Note not saved — will retry when online'),
            });
          }
        },
        error: _err => {
          this.markForRetry('Trip not saved — will retry when online');
        },
      });
    } else if (this.auth.isProvisioned()) {
      this.markForRetry();
    }
  }

  updateNotes(id: string, notes: string): void {
    const trimmed = notes.trim().slice(0, 500);
    const updated = this._trips().map(t =>
      t.id === id ? { ...t, notes: trimmed || undefined } : t,
    );
    this._trips.set(updated);
    this.saveLocal(updated);

    if (id.startsWith('local_')) {
      return;
    }

    if (this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.updateTripNotes(id, trimmed).subscribe({
        error: _err => this.markForRetry('Note not saved — will retry when online'),
      });
    } else if (!id.startsWith('local_') && this.auth.isProvisioned()) {
      this.markForRetry();
    }
  }

  deleteTrip(id: string): void {
    if (id.startsWith('local_')) {
      this.deletedLocalIds.add(id);
    }

    const updated = this._trips().filter(t => t.id !== id);
    this._trips.set(updated);
    this.saveLocal(updated);

    // Only hit the API for real (non-temp) ids
    if (!id.startsWith('local_') && this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.deleteTrip(id).subscribe({
        error: _err => this.markForRetry('Trip could not be deleted from server'),
      });
    } else if (!id.startsWith('local_') && this.auth.isProvisioned()) {
      this.markForRetry();
    }
  }

  clearAll(): void {
    const current = this._trips();
    this._trips.set([]);
    this.saveLocal([]);

    if (this.auth.isProvisioned() && this.network.isOnline()) {
      for (const t of current) {
        if (!t.id.startsWith('local_')) {
          this.api.deleteTrip(t.id).subscribe({
            error: _err => this.markForRetry('Some trips could not be deleted from server'),
          });
        }
      }
    } else if (this.auth.isProvisioned()) {
      this.markForRetry();
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

  private pushLocalToApi(trips: SavedTrip[]): void {
    for (const trip of trips) {
      this.api.createTrip({
        tripType: trip.tripType,
        origin: trip.origin,
        destination: trip.destination,
        cabin: trip.cabin,
        passengers: trip.passengers,
        nights: trip.nights,
        hotelCat: trip.hotelCat,
        programName: trip.programName,
        ptsRequired: trip.ptsRequired,
        notes: trip.notes,
      }).subscribe({
        next: saved => {
          if (this.deletedLocalIds.has(trip.id)) {
            this.deletedLocalIds.delete(trip.id);
            this.api.deleteTrip(saved.id).subscribe({
              error: _err => this.markForRetry('Trip could not be deleted from server'),
            });
            return;
          }

          const optimistic = this._trips().find(t => t.id === trip.id);
          const savedWithLocalEdits = optimistic ? { ...saved, notes: optimistic.notes } : saved;
          const current = this._trips().map(t => t.id === trip.id ? savedWithLocalEdits : t);
          this._trips.set(current);
          this.saveLocal(current);

          if (optimistic?.notes !== trip.notes) {
            this.api.updateTripNotes(saved.id, optimistic?.notes ?? '').subscribe({
              error: _err => this.markForRetry('Note not saved — will retry when online'),
            });
          }
        },
        error: _err => {
          this.markForRetry('Trip not saved — will retry when online');
        },
      });
    }
  }

  private markForRetry(message?: string): void {
    this._apiLoaded = false;
    this._syncState.set('error');
    if (message) this.toast.error(message);
  }
}

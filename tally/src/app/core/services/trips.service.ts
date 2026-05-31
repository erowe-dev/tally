import { Injectable, signal, inject, effect, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';
import { SavedTrip } from '../models';

const STORAGE_KEY = 'tally_trips_v1';
const PENDING_KEY = 'tally_trips_pending_v1';
const DELETED_KEY = 'tally_trips_deleted_v1';
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
          next: trips => this.hydrateFromApi(trips),
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
    if (this.auth.isProvisioned()) this.savePending(optimistic);

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
          this.clearPending(tempId);
          this.clearPending(saved.id);

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
    const changed = updated.find(t => t.id === id);

    if (id.startsWith('local_')) {
      if (changed && this.auth.isProvisioned()) this.savePending(changed);
      return;
    }

    if (changed && this.auth.isProvisioned()) this.savePending(changed);

    if (this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.updateTripNotes(id, trimmed).subscribe({
        next: () => this.clearPending(id),
        error: _err => this.markForRetry('Note not saved — will retry when online'),
      });
    } else if (!id.startsWith('local_') && this.auth.isProvisioned()) {
      this.markForRetry();
    }
  }

  deleteTrip(id: string): void {
    if (id.startsWith('local_')) {
      this.deletedLocalIds.add(id);
      this.clearPending(id);
    } else {
      this.saveDeleted(id);
      this.clearPending(id);
    }

    const updated = this._trips().filter(t => t.id !== id);
    this._trips.set(updated);
    this.saveLocal(updated);

    // Only hit the API for real (non-temp) ids
    if (!id.startsWith('local_') && this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.deleteTrip(id).subscribe({
        next: () => this.clearDeleted(id),
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
          this.saveDeleted(t.id);
          this.clearPending(t.id);
          this.api.deleteTrip(t.id).subscribe({
            next: () => this.clearDeleted(t.id),
            error: _err => this.markForRetry('Some trips could not be deleted from server'),
          });
        } else {
          this.deletedLocalIds.add(t.id);
          this.clearPending(t.id);
        }
      }
    } else if (this.auth.isProvisioned()) {
      for (const t of current) {
        if (t.id.startsWith('local_')) {
          this.deletedLocalIds.add(t.id);
          this.clearPending(t.id);
        } else {
          this.saveDeleted(t.id);
          this.clearPending(t.id);
        }
      }
      this.markForRetry();
    }
  }

  private hydrateFromApi(apiTrips: SavedTrip[]): void {
    const localTrips = this.loadLocal();
    const pending = this.loadPending();
    const deleted = new Set(this.loadDeleted());
    const pendingTrips = Object.values(pending).filter(trip => !deleted.has(trip.id));
    const pendingIds = new Set(pendingTrips.map(trip => trip.id));
    const localOnlyTrips = localTrips
      .filter(trip => trip.id.startsWith('local_') && !pendingIds.has(trip.id));
    const localHasData = localTrips.length > 0;
    const apiIsEmpty = apiTrips.length === 0;

    if (deleted.size > 0) {
      for (const id of deleted) this.deleteRemote(id);
    }

    if (pendingTrips.length > 0 || localOnlyTrips.length > 0) {
      const merged = [
        ...pendingTrips,
        ...localOnlyTrips,
        ...apiTrips.filter(trip => !deleted.has(trip.id) && !pending[trip.id]),
      ];
      this._trips.set(merged);
      this.saveLocal(merged);
      this._syncState.set('synced');
      for (const trip of [...pendingTrips, ...localOnlyTrips]) this.pushPendingTrip(trip);
      return;
    }

    if (apiIsEmpty && localHasData) {
      this._trips.set(localTrips);
      this._syncState.set('synced');
      this.pushLocalToApi(localTrips.filter(trip => !deleted.has(trip.id)));
      return;
    }

    const filtered = apiTrips.filter(trip => !deleted.has(trip.id));
    this._trips.set(filtered);
    this.saveLocal(filtered);
    this._syncState.set('synced');
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

  private loadPending(): Record<string, SavedTrip> {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, SavedTrip] => isSavedTrip(entry[1])),
      );
    } catch {
      return {};
    }
  }

  private savePending(trip: SavedTrip): void {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ ...this.loadPending(), [trip.id]: trip }));
    } catch {}
  }

  private clearPending(id: string): void {
    try {
      const pending = this.loadPending();
      delete pending[id];
      if (Object.keys(pending).length === 0) {
        localStorage.removeItem(PENDING_KEY);
      } else {
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      }
    } catch {}
  }

  private loadDeleted(): string[] {
    try {
      const raw = localStorage.getItem(DELETED_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private saveDeleted(id: string): void {
    try {
      localStorage.setItem(DELETED_KEY, JSON.stringify([...new Set([...this.loadDeleted(), id])]));
    } catch {}
  }

  private clearDeleted(id: string): void {
    try {
      const deleted = this.loadDeleted().filter(existing => existing !== id);
      if (deleted.length === 0) {
        localStorage.removeItem(DELETED_KEY);
      } else {
        localStorage.setItem(DELETED_KEY, JSON.stringify(deleted));
      }
    } catch {}
  }

  private pushPendingTrip(trip: SavedTrip): void {
    if (!this.auth.isProvisioned()) return;
    if (!this.network.isOnline()) {
      this.markForRetry();
      return;
    }

    if (trip.id.startsWith('local_')) {
      this.createRemoteTrip(trip);
      return;
    }

    this.api.updateTripNotes(trip.id, trip.notes ?? '').subscribe({
      next: () => this.clearPending(trip.id),
      error: _err => this.markForRetry('Note not saved — will retry when online'),
    });
  }

  private pushLocalToApi(trips: SavedTrip[]): void {
    for (const trip of trips) {
      this.createRemoteTrip(trip);
    }
  }

  private createRemoteTrip(trip: SavedTrip): void {
    this.api.createTrip(toTripPayload(trip)).subscribe({
        next: saved => {
          if (this.deletedLocalIds.has(trip.id)) {
            this.deletedLocalIds.delete(trip.id);
            this.clearPending(trip.id);
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
          this.clearPending(trip.id);
          this.clearPending(saved.id);

          if (optimistic?.notes !== trip.notes) {
            this.api.updateTripNotes(saved.id, optimistic?.notes ?? '').subscribe({
              error: _err => this.markForRetry('Note not saved — will retry when online'),
            });
          }
        },
        error: _err => {
          this.savePending(trip);
          this.markForRetry('Trip not saved — will retry when online');
        },
      });
  }

  private deleteRemote(id: string): void {
    this.api.deleteTrip(id).subscribe({
      next: () => this.clearDeleted(id),
      error: _err => this.markForRetry('Trip could not be deleted from server'),
    });
  }

  private markForRetry(message?: string): void {
    this._apiLoaded = false;
    this._syncState.set('error');
    if (message) this.toast.error(message);
  }
}

function toTripPayload(trip: SavedTrip): Omit<SavedTrip, 'id' | 'createdAt'> {
  return {
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
  };
}

function isSavedTrip(value: unknown): value is SavedTrip {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as SavedTrip;
  return (
    typeof candidate.id === 'string' &&
    (candidate.tripType === 'flight' || candidate.tripType === 'hotel') &&
    typeof candidate.programName === 'string' &&
    typeof candidate.ptsRequired === 'number' &&
    Number.isFinite(candidate.ptsRequired) &&
    typeof candidate.createdAt === 'string'
  );
}

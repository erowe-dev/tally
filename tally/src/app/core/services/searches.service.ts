import { Injectable, effect, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';
import { SavedSearch } from '../models';

const STORAGE_KEY = 'tally_searches_v1';
const PENDING_KEY = 'tally_searches_pending_v1';
const DELETED_KEY = 'tally_searches_deleted_v1';
const MAX_SAVED_SEARCHES = 5;

export type SearchSyncState = 'idle' | 'loading' | 'synced' | 'error';

@Injectable({ providedIn: 'root' })
export class SearchesService {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private network = inject(NetworkService);
  private toast = inject(ToastService);

  private _searches = signal<SavedSearch[]>(this.loadLocal());
  private _syncState = signal<SearchSyncState>('idle');
  private _retryTrigger = signal(0);
  private _apiLoaded = false;
  private deletedLocalIds = new Set<string>();

  readonly searches = this._searches.asReadonly();
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

        this.api.getSavedSearches().subscribe({
          next: apiSearches => this.hydrateFromApi(apiSearches),
          error: _err => {
            this.toast.error('Could not load saved searches — using cached data');
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

  createSearch(search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>): SavedSearch | null {
    if (this._searches().length >= MAX_SAVED_SEARCHES) {
      this.toast.error('Delete a saved search before adding another');
      return null;
    }

    const now = new Date().toISOString();
    const saved: SavedSearch = {
      ...search,
      id: `local_${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [saved, ...this._searches()];
    this._searches.set(updated);
    this.saveLocal(updated);
    this.savePending(saved);
    this.pushPendingSearch(saved);
    return saved;
  }

  updateSearch(id: string, changes: Partial<Omit<SavedSearch, 'id' | 'createdAt'>>): void {
    const updatedAt = new Date().toISOString();
    const updated = this._searches().map(search =>
      search.id === id ? { ...search, ...changes, updatedAt } : search,
    );
    const changed = updated.find(search => search.id === id);
    if (!changed) return;

    this._searches.set(updated);
    this.saveLocal(updated);
    this.savePending(changed);
    this.pushPendingSearch(changed);
  }

  deleteSearch(id: string): void {
    if (id.startsWith('local_')) {
      this.deletedLocalIds.add(id);
      this.clearPending(id);
    } else {
      this.saveDeleted(id);
    }

    const updated = this._searches().filter(search => search.id !== id);
    this._searches.set(updated);
    this.saveLocal(updated);

    if (!id.startsWith('local_') && this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.deleteSavedSearch(id).subscribe({
        next: () => this.clearDeleted(id),
        error: _err => this.markForRetry('Saved search could not be deleted from server'),
      });
    } else if (!id.startsWith('local_') && this.auth.isProvisioned()) {
      this.markForRetry();
    }
  }

  markRun(id: string): void {
    this.updateSearch(id, { lastRunAt: new Date().toISOString() });
  }

  private hydrateFromApi(apiSearches: SavedSearch[]): void {
    const localSearches = this.loadLocal();
    const pending = this.loadPending();
    const deleted = new Set(this.loadDeleted());
    const pendingSearches = Object.values(pending);
    const localOnly = localSearches.filter(search => search.id.startsWith('local_'));
    const localHasData = localSearches.length > 0;
    const apiIsEmpty = apiSearches.length === 0;

    if (deleted.size > 0) {
      for (const id of deleted) this.deleteRemote(id);
    }

    if (pendingSearches.length > 0 || localOnly.length > 0) {
      const pendingIds = new Set(pendingSearches.map(search => search.id));
      const merged = [
        ...pendingSearches,
        ...localOnly.filter(search => !pendingIds.has(search.id)),
        ...apiSearches.filter(search => !deleted.has(search.id) && !pending[search.id]),
      ];
      this._searches.set(merged);
      this.saveLocal(merged);
      this._syncState.set('synced');
      for (const search of [...pendingSearches, ...localOnly]) this.pushPendingSearch(search);
    } else if (apiIsEmpty && localHasData) {
      this._searches.set(localSearches);
      this._syncState.set('synced');
      for (const search of localSearches) this.createRemoteSearch(search);
    } else {
      const filtered = apiSearches.filter(search => !deleted.has(search.id));
      this._searches.set(filtered);
      this.saveLocal(filtered);
      this._syncState.set('synced');
    }
  }

  private pushPendingSearch(search: SavedSearch): void {
    if (!this.auth.isProvisioned()) return;
    if (!this.network.isOnline()) {
      this.markForRetry();
      return;
    }

    if (search.id.startsWith('local_')) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = search;
      this.api.createSavedSearch(payload).subscribe({
        next: saved => this.replaceLocalSearch(search.id, saved),
        error: _err => this.markForRetry('Saved search not synced — will retry when online'),
      });
      return;
    }

    const { id: _id, createdAt: _createdAt, ...changes } = search;
    this.api.updateSavedSearch(search.id, changes).subscribe({
      next: saved => this.replaceLocalSearch(search.id, saved),
      error: _err => this.markForRetry('Saved search not synced — will retry when online'),
    });
  }

  private createRemoteSearch(search: SavedSearch): void {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = search;
    this.api.createSavedSearch(payload).subscribe({
      next: saved => this.replaceLocalSearch(search.id, saved),
      error: _err => {
        this.savePending(search);
        this.markForRetry('Saved search not synced — will retry when online');
      },
    });
  }

  private replaceLocalSearch(previousId: string, saved: SavedSearch): void {
    if (this.deletedLocalIds.has(previousId)) {
      this.deletedLocalIds.delete(previousId);
      this.api.deleteSavedSearch(saved.id).subscribe({
        error: _err => this.markForRetry('Saved search could not be deleted from server'),
      });
      return;
    }

    const updated = this._searches().map(search => search.id === previousId ? saved : search);
    this._searches.set(updated);
    this.saveLocal(updated);
    this.clearPending(previousId);
    this.clearPending(saved.id);
    this._syncState.set('synced');
  }

  private deleteRemote(id: string): void {
    this.api.deleteSavedSearch(id).subscribe({
      next: () => this.clearDeleted(id),
      error: _err => this.markForRetry('Saved search could not be deleted from server'),
    });
  }

  private markForRetry(message?: string): void {
    this._apiLoaded = false;
    this._syncState.set('error');
    if (message) this.toast.error(message);
  }

  private loadLocal(): SavedSearch[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter(isSavedSearch) : [];
    } catch {
      return [];
    }
  }

  private saveLocal(searches: SavedSearch[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch {}
  }

  private loadPending(): Record<string, SavedSearch> {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(
        Object.entries(parsed).filter((entry): entry is [string, SavedSearch] => isSavedSearch(entry[1])),
      );
    } catch {
      return {};
    }
  }

  private savePending(search: SavedSearch): void {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ ...this.loadPending(), [search.id]: search }));
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
}

function isSavedSearch(value: unknown): value is SavedSearch {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as SavedSearch;
  return (
    typeof candidate.id === 'string' &&
    (candidate.searchType === 'flight' || candidate.searchType === 'hotel') &&
    typeof candidate.destinationText === 'string' &&
    !!candidate.dateWindow &&
    typeof candidate.dateWindow === 'object' &&
    typeof candidate.passengers === 'number' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

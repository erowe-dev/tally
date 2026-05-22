import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { DataService } from './data.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';
import { ToastService } from './toast.service';
import { AnalyticsService } from './analytics.service';

const STORAGE_KEY = 'tally_wallet_v1';
const HISTORY_KEY = 'tally_wallet_history_v1';
const PENDING_KEY = 'tally_wallet_pending_v1';
const MAX_BALANCE = 50_000_000;
const MAX_HISTORY = 30; // days

export interface HistoryEntry { date: string; total: number; }

/**
 * Possible states for API sync:
 * - 'idle'    — not yet authenticated / not triggered
 * - 'loading' — first fetch in-flight
 * - 'synced'  — API data loaded successfully this session
 * - 'error'   — API load failed; using localStorage cache
 */
export type SyncState = 'idle' | 'loading' | 'synced' | 'error';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private network = inject(NetworkService);
  private toast = inject(ToastService);
  private analytics = inject(AnalyticsService);
  // DataService kept to preserve existing canCover() usage in optimizer
  private data = inject(DataService);

  private _balances = signal<Record<string, number>>(this.loadLocal());
  private _syncState = signal<SyncState>('idle');
  private _history = signal<HistoryEntry[]>(this.loadHistory());
  private _retryTrigger = signal(0);

  private _apiLoaded = false;

  readonly balances = this._balances.asReadonly();
  readonly syncState = this._syncState.asReadonly();
  readonly history = this._history.asReadonly();

  readonly totalPoints = computed(() =>
    Object.values(this._balances()).reduce((a, b) => a + b, 0),
  );

  /**
   * Estimated portfolio value using each program's best partner CPP.
   * Falls back to 1.6¢ for any program with no partners defined.
   */
  readonly estimatedValue = computed(() => {
    let total = 0;
    for (const card of this.data.cards) {
      const bal = this._balances()[card.id] ?? 0;
      if (bal <= 0) continue;
      const bestCpp = card.partners.length
        ? Math.max(...card.partners.map(p => p.cpp))
        : 1.6;
      total += Math.round(bal * bestCpp / 100);
    }
    return total;
  });

  readonly hasAnyPoints = computed(() => this.totalPoints() > 0);

  constructor() {
    // Load from API once per session, after user row is confirmed to exist.
    // Gating on isProvisioned() prevents a 404 race where GET /api/balances
    // arrives before POST /api/users/me finishes.
    effect(() => {
      this._retryTrigger(); // tracked so retryLoad() can re-fire the effect
      if (
        !this._apiLoaded &&
        this.auth.isResolved() &&
        this.auth.isAuthenticated() &&
        this.auth.isProvisioned() &&
        this.network.isOnline()
      ) {
        this._apiLoaded = true;
        this._syncState.set('loading');

        this.api.getBalancesWithCache().subscribe({
          next: apiBalances => {
            const localBalances = this.loadLocal();
            const pendingBalances = this.loadPending();
            const localHasData = Object.keys(localBalances).some(k => (localBalances[k] ?? 0) > 0);
            const apiIsEmpty = Object.keys(apiBalances).length === 0;
            const hasPending = Object.keys(pendingBalances).length > 0;

            if (hasPending) {
              const merged = { ...apiBalances, ...pendingBalances };
              this._balances.set(merged);
              this.saveLocal(merged);
              this.api.cacheBalances(merged);
              this._syncState.set('synced');
              this._pushLocalToApi(pendingBalances, true);
            } else if (apiIsEmpty && localHasData) {
              // First login with existing local data — push local state up to
              // the API rather than silently wiping the user's saved balances.
              this._balances.set(localBalances);
              this._syncState.set('synced');
              this._pushLocalToApi(localBalances, false);
            } else {
              // API has data (or both are empty) — API is source of truth.
              this._balances.set(apiBalances);
              this.saveLocal(apiBalances);
              this._syncState.set('synced');
              this.recordSnapshot(Object.values(apiBalances).reduce((a, b) => a + b, 0));
            }
          },
          error: _err => {
            this.toast.error('Could not load balances — using cached data');
            this._syncState.set('error');
            // Reset so the effect can retry — it will re-fire when network
            // comes back online (isOnline() signal changes true→false→true)
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

  setBalance(cardId: string, value: number): void {
    const amount = Math.min(MAX_BALANCE, Math.max(0, Math.round(value || 0)));
    const updated = { ...this._balances(), [cardId]: amount };

    // Write locally first — instant UI response, works offline
    this._balances.set(updated);
    this.saveLocal(updated);
    this.api.cacheBalances(updated);
    this.recordSnapshot(Object.values(updated).reduce((a, b) => a + b, 0));
    this.analytics.track('balance_updated', { card_id: cardId, non_zero: amount > 0 });
    this.savePending(cardId, amount);

    // Fire-and-forget sync to API only after provisioning is confirmed and online
    if (this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.setBalance(cardId, amount).subscribe({
        next: () => this.clearPending(cardId),
        error: _err => this.markForRetry('Balance not saved — will retry when online'),
      });
    } else if (this.auth.isProvisioned()) {
      this.markForRetry();
    }
  }

  getBalance(cardId: string): number {
    return this._balances()[cardId] ?? 0;
  }

  canCover(cardIds: string[], ptsRequired: number): boolean {
    if (!this.hasAnyPoints()) return false;
    return cardIds.some(id => (this._balances()[id] ?? 0) >= ptsRequired);
  }

  private _pushLocalToApi(balances: Record<string, number>, clearOnSuccess: boolean): void {
    const entries = clearOnSuccess
      ? Object.entries(balances)
      : Object.entries(balances).filter(([, v]) => v > 0);
    for (const [cardId, amount] of entries) {
      this.api.setBalance(cardId, amount).subscribe({
        next: () => {
          if (clearOnSuccess) this.clearPending(cardId);
        },
        error: _err => this.markForRetry('Balance not saved — will retry when online'),
      });
    }
  }

  private markForRetry(message?: string): void {
    this._apiLoaded = false;
    this._syncState.set('error');
    if (message) this.toast.error(message);
  }

  /** Upserts today's total into the daily history ring-buffer */
  private recordSnapshot(total: number): void {
    const today = new Date().toISOString().slice(0, 10);
    const history = [...this._history()];
    const last = history[history.length - 1];
    if (last?.date === today) {
      last.total = total;
    } else {
      history.push({ date: today, total });
      if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    }
    this._history.set(history);
    this.saveHistory(history);
  }

  private loadLocal(): Record<string, number> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  private saveLocal(balances: Record<string, number>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(balances));
    } catch {
      // Storage unavailable — not a fatal error
    }
  }

  private loadPending(): Record<string, number> {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  private savePending(cardId: string, amount: number): void {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ ...this.loadPending(), [cardId]: amount }));
    } catch {}
  }

  private clearPending(cardId: string): void {
    try {
      const pending = this.loadPending();
      delete pending[cardId];
      if (Object.keys(pending).length === 0) {
        localStorage.removeItem(PENDING_KEY);
      } else {
        localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
      }
    } catch {}
  }

  private loadHistory(): HistoryEntry[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    } catch {
      return [];
    }
  }

  private saveHistory(history: HistoryEntry[]): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {}
  }
}

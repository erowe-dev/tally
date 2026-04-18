import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { DataService } from './data.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';

const STORAGE_KEY = 'tally_wallet_v1';
const HISTORY_KEY = 'tally_wallet_history_v1';
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
  // DataService kept to preserve existing canCover() usage in optimizer
  private data = inject(DataService);

  private _balances = signal<Record<string, number>>(this.loadLocal());
  private _syncState = signal<SyncState>('idle');
  private _history = signal<HistoryEntry[]>(this.loadHistory());

  // Prevent the effect from running more than once per session even if
  // signals are re-evaluated (e.g. token refresh re-emits isLoading)
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
      if (
        !this._apiLoaded &&
        this.auth.isResolved() &&
        this.auth.isAuthenticated() &&
        this.auth.isProvisioned() &&
        this.network.isOnline()
      ) {
        this._apiLoaded = true;
        this._syncState.set('loading');

        this.api.getBalances().subscribe({
          next: apiBalances => {
            const localBalances = this.loadLocal();
            const localHasData = Object.keys(localBalances).some(k => (localBalances[k] ?? 0) > 0);
            const apiIsEmpty = Object.keys(apiBalances).length === 0;

            if (apiIsEmpty && localHasData) {
              // First login with existing local data — push local state up to
              // the API rather than silently wiping the user's saved balances.
              this._balances.set(localBalances);
              this._syncState.set('synced');
              this._pushLocalToApi(localBalances);
            } else {
              // API has data (or both are empty) — API is source of truth.
              this._balances.set(apiBalances);
              this.saveLocal(apiBalances);
              this._syncState.set('synced');
              this.recordSnapshot(Object.values(apiBalances).reduce((a, b) => a + b, 0));
            }
          },
          error: err => {
            console.error('[WalletService] API load failed, using localStorage cache:', err);
            this._syncState.set('error');
            // Reset so the effect can retry — it will re-fire when network
            // comes back online (isOnline() signal changes true→false→true)
            this._apiLoaded = false;
          },
        });
      }
    });
  }

  setBalance(cardId: string, value: number): void {
    const amount = Math.max(0, Math.round(value || 0));
    const updated = { ...this._balances(), [cardId]: amount };

    // Write locally first — instant UI response, works offline
    this._balances.set(updated);
    this.saveLocal(updated);
    this.recordSnapshot(Object.values(updated).reduce((a, b) => a + b, 0));

    // Fire-and-forget sync to API only after provisioning is confirmed and online
    if (this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.setBalance(cardId, amount).subscribe({
        error: err => console.error('[WalletService] API sync failed:', err),
      });
    }
  }

  getBalance(cardId: string): number {
    return this._balances()[cardId] ?? 0;
  }

  canCover(cardIds: string[], ptsRequired: number): boolean {
    if (!this.hasAnyPoints()) return false;
    return cardIds.some(id => (this._balances()[id] ?? 0) >= ptsRequired);
  }

  private _pushLocalToApi(balances: Record<string, number>): void {
    const entries = Object.entries(balances).filter(([, v]) => v > 0);
    for (const [cardId, amount] of entries) {
      this.api.setBalance(cardId, amount).subscribe({
        error: err =>
          console.error(`[WalletService] Failed to push local ${cardId} to API:`, err),
      });
    }
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

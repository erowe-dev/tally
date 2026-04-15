import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { DataService } from './data.service';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

const STORAGE_KEY = 'tally_wallet_v1';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  // DataService kept to preserve existing canCover() usage in optimizer
  private data = inject(DataService);

  private _balances = signal<Record<string, number>>(this.loadLocal());

  readonly balances = this._balances.asReadonly();

  readonly totalPoints = computed(() =>
    Object.values(this._balances()).reduce((a, b) => a + b, 0),
  );

  readonly estimatedValue = computed(() =>
    Math.round(this.totalPoints() * 0.016),
  );

  readonly hasAnyPoints = computed(() => this.totalPoints() > 0);

  constructor() {
    // When Auth0 finishes its session check and the user is logged in,
    // fetch from the API (source of truth) and overwrite the local cache.
    effect(() => {
      if (this.auth.isResolved() && this.auth.isAuthenticated()) {
        this.api.getBalances().subscribe({
          next: balances => {
            this._balances.set(balances);
            this.saveLocal(balances);
          },
          error: err =>
            console.error('[WalletService] API load failed, using localStorage cache:', err),
        });
      }
    });
  }

  setBalance(cardId: string, value: number): void {
    const amount = Math.max(0, value || 0);
    const updated = { ...this._balances(), [cardId]: amount };

    // Write locally first — instant UI response, works offline
    this._balances.set(updated);
    this.saveLocal(updated);

    // Fire-and-forget sync to API if logged in
    if (this.auth.isAuthenticated()) {
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

  private loadLocal(): Record<string, number> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
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
}

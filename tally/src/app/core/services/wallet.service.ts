import { Injectable, signal, computed } from '@angular/core';
import { DataService } from './data.service';

const STORAGE_KEY = 'tally_wallet_v1';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private _balances = signal<Record<string, number>>(this.loadBalances());

  readonly balances = this._balances.asReadonly();

  readonly totalPoints = computed(() =>
    Object.values(this._balances()).reduce((a, b) => a + b, 0)
  );

  readonly estimatedValue = computed(() =>
    Math.round(this.totalPoints() * 0.016)
  );

  readonly hasAnyPoints = computed(() => this.totalPoints() > 0);

  constructor(private data: DataService) {}

  setBalance(cardId: string, value: number): void {
    const updated = { ...this._balances(), [cardId]: Math.max(0, value || 0) };
    this._balances.set(updated);
    this.saveBalances(updated);
  }

  getBalance(cardId: string): number {
    return this._balances()[cardId] ?? 0;
  }

  canCover(cardIds: string[], ptsRequired: number): boolean {
    if (!this.hasAnyPoints()) return false;
    return cardIds.some(id => (this._balances()[id] ?? 0) >= ptsRequired);
  }

  private loadBalances(): Record<string, number> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveBalances(balances: Record<string, number>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(balances));
    } catch {
      // storage unavailable
    }
  }
}

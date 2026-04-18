import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../../core/services/wallet.service';
import { DataService } from '../../core/services/data.service';
import { CreditCard } from '../../core/models';

@Component({
  selector: 'tally-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content">
      <div class="section-eyebrow">My Points Wallet</div>
      <h2 class="section-title">Enter your <em>balances</em></h2>

      <!-- Sync status pill -->
      <div class="sync-pill" [class]="wallet.syncState()">
        <span class="sync-dot"></span>
        <span class="sync-text">{{ syncLabel() }}</span>
      </div>

      <!-- Loading shimmer -->
      <ng-container *ngIf="wallet.syncState() === 'loading'">
        <div class="wallet-list">
          <div class="shimmer-row" *ngFor="let n of [1,2,3,4,5]"></div>
        </div>
      </ng-container>

      <!-- Program groups -->
      <ng-container *ngIf="wallet.syncState() !== 'loading'">
        <div *ngFor="let group of programGroups" class="program-group">
          <div class="group-header">
            <span class="group-icon">{{ group.icon }}</span>
            <span class="group-label">{{ group.label }}</span>
            <span class="group-total" *ngIf="groupTotal(group.cards) > 0">
              {{ groupTotal(group.cards) | number }} pts
            </span>
          </div>

          <div class="wallet-list">
            <div class="wallet-row" *ngFor="let card of group.cards">
              <div class="card-badge" [style.background]="card.color">{{ card.icon }}</div>
              <div class="card-info">
                <div class="card-name">{{ card.name }}</div>
                <div class="card-sub">{{ card.cards[0] }}<span *ngIf="card.cards.length > 1"> & more</span></div>
              </div>
              <div class="input-wrap">
                <input
                  class="balance-input"
                  type="number"
                  inputmode="numeric"
                  placeholder="0"
                  [value]="wallet.getBalance(card.id) || null"
                  (input)="onInput(card.id, $event)"
                  min="0" step="1000">
                <div class="row-value" *ngIf="wallet.getBalance(card.id) > 0">
                  ~\${{ rowValue(card) | number }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </ng-container>

      <div class="divider"></div>

      <div class="summary" *ngIf="wallet.hasAnyPoints(); else noPoints">
        <div class="summary-label">Estimated Total Value</div>
        <div class="summary-value">\${{ wallet.estimatedValue() | number }}</div>
        <div class="summary-sub">{{ wallet.totalPoints() | number }} total points · blended ~1.6¢/pt</div>
        <div class="summary-note">
          This is a conservative blended estimate. Optimal transfers can yield 2–3× more.
          Use the Optimizer to find your best redemption.
        </div>
      </div>

      <ng-template #noPoints>
        <div class="empty-state">
          <div class="empty-icon">💳</div>
          <p>Add your balances above to see your total estimated value</p>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    /* Sync status pill */
    .sync-pill {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.08em; text-transform: uppercase;
      padding: 4px 10px; border-radius: 20px;
      border: 1px solid var(--border); margin-bottom: 20px;
      color: var(--text3); background: var(--surface);
      transition: all 0.3s;
    }
    .sync-pill.synced { border-color: rgba(26,122,74,0.3); color: var(--tally-green); background: var(--tally-green-light); }
    .sync-pill.error  { border-color: rgba(220,38,38,0.3); color: var(--tally-red); background: var(--tally-red-light); }
    .sync-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
    .sync-pill.loading .sync-dot { animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

    /* Shimmer */
    .shimmer-row {
      height: 64px; border-radius: 14px; margin-bottom: 10px;
      background: linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%);
      background-size: 200% 100%; animation: shimmer 1.4s ease-in-out infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Program groups */
    .program-group { margin-bottom: 20px; }
    .group-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
      padding: 0 2px;
    }
    .group-icon { font-size: 13px; }
    .group-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.15em; text-transform: uppercase; color: var(--text3);
      flex: 1;
    }
    .group-total {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--tally-green); letter-spacing: 0.04em;
    }

    /* Card list */
    .wallet-list { display: flex; flex-direction: column; gap: 8px; }

    .wallet-row {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 14px; padding: 12px 14px;
      display: flex; align-items: center; gap: 12px;
    }
    .card-badge {
      width: 38px; height: 26px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0;
    }
    .card-info { flex: 1; min-width: 0; }
    .card-name { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-sub { font-size: 10px; color: var(--text3); font-family: 'Geist Mono', monospace; margin-top: 1px; }

    .balance-input {
      background: var(--surface); border: 1.5px solid var(--border2);
      border-radius: 9px; color: var(--tally-green);
      font-family: 'Geist Mono', monospace; font-size: 13px;
      padding: 7px 9px; width: 90px; text-align: right;
      outline: none; transition: border-color 0.15s;
      -moz-appearance: textfield;
    }
    .balance-input::-webkit-outer-spin-button,
    .balance-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .balance-input:focus { border-color: var(--tally-green); }
    .balance-input::placeholder { color: var(--border2); }

    .input-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .row-value {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--tally-green-mid, #2d8a5a); letter-spacing: 0.04em;
    }

    .divider { height: 1px; background: var(--border); margin: 24px 0; }

    .summary { text-align: center; padding: 8px 0 16px; }
    .summary-label {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.15em; color: var(--text3); text-transform: uppercase; margin-bottom: 8px;
    }
    .summary-value {
      font-family: 'Instrument Serif', serif; font-size: 48px;
      color: var(--tally-green); line-height: 1; margin-bottom: 8px;
    }
    .summary-sub {
      font-family: 'Geist Mono', monospace; font-size: 11px;
      color: var(--text3); letter-spacing: 0.08em; margin-bottom: 16px;
    }
    .summary-note {
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2);
      border-radius: 10px; padding: 12px 16px;
      font-size: 13px; color: var(--tally-green); line-height: 1.5; text-align: left;
    }

    .empty-state { text-align: center; padding: 40px 16px; }
    .empty-icon { font-size: 36px; margin-bottom: 12px; }
    .empty-state p {
      font-family: 'Instrument Serif', serif; font-style: italic;
      font-size: 17px; color: var(--text2); line-height: 1.5;
    }
  `]
})
export class WalletComponent {
  wallet = inject(WalletService);
  data = inject(DataService);

  readonly programGroups = [
    {
      label: 'Transferable Currencies',
      icon: '↔',
      cards: this.data.cards.filter(c => c.category === 'transferable'),
    },
    {
      label: 'Airline Programs',
      icon: '✈',
      cards: this.data.cards.filter(c => c.category === 'airline'),
    },
    {
      label: 'Hotel Programs',
      icon: '🏨',
      cards: this.data.cards.filter(c => c.category === 'hotel'),
    },
  ];

  groupTotal(cards: CreditCard[]): number {
    return cards.reduce((sum, c) => sum + this.wallet.getBalance(c.id), 0);
  }

  syncLabel(): string {
    switch (this.wallet.syncState()) {
      case 'idle':    return 'Local';
      case 'loading': return 'Syncing…';
      case 'synced':  return 'Synced';
      case 'error':   return 'Offline — local only';
    }
  }

  /** Estimated dollar value of a single card's balance (using best partner CPP) */
  rowValue(card: CreditCard): number {
    const balance = this.wallet.getBalance(card.id);
    const bestCpp = Math.max(...card.partners.map(p => p.cpp));
    return Math.round(balance * bestCpp / 100);
  }

  onInput(cardId: string, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value) || 0;
    this.wallet.setBalance(cardId, val);
  }
}

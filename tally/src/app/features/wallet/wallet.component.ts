import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService, HistoryEntry } from '../../core/services/wallet.service';
import { DataService } from '../../core/services/data.service';
import { OptimizerService } from '../../core/services/optimizer.service';
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
                <!-- Quick-add buttons — only show when expanded -->
                <div class="quick-add" *ngIf="expandedCard() === card.id">
                  <button *ngFor="let inc of quickIncrements"
                    class="qa-btn" (click)="quickAdd(card.id, inc)">
                    +{{ formatInc(inc) }}
                  </button>
                </div>
              </div>
              <div class="input-wrap" (click)="toggleExpand(card.id)">
                <input
                  class="balance-input"
                  type="number"
                  inputmode="numeric"
                  placeholder="0"
                  [value]="wallet.getBalance(card.id) || null"
                  (click)="$event.stopPropagation(); toggleExpand(card.id)"
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

      <!-- Point Goal Tracker -->
      <div class="goal-section">
        <div class="goal-header">
          <span class="goal-label">Point Goal</span>
          <button class="goal-toggle" (click)="showGoal.set(!showGoal())">
            {{ showGoal() ? 'Hide' : 'Set Goal' }}
          </button>
        </div>
        <ng-container *ngIf="showGoal()">
          <div class="goal-inputs">
            <input class="goal-name-input" [(ngModel)]="goalName" placeholder="e.g. Tokyo Business Class">
            <input class="goal-pts-input" type="number" inputmode="numeric" [(ngModel)]="goalPts"
              placeholder="60000" min="0" step="5000">
          </div>
          <div class="goal-progress" *ngIf="goalPts > 0">
            <div class="goal-bar-wrap">
              <div class="goal-bar" [style.width]="goalPct() + '%'" [class.complete]="goalPct() >= 100"></div>
            </div>
            <div class="goal-stat">
              <span class="goal-have" [class.complete]="goalPct() >= 100">
                {{ wallet.totalPoints() | number }}
              </span>
              <span class="goal-sep"> / </span>
              <span class="goal-need">{{ goalPts | number }} pts</span>
              <span class="goal-pct" [class.complete]="goalPct() >= 100">
                {{ goalPct() }}%
              </span>
            </div>
            <div class="goal-remaining" *ngIf="goalPct() < 100">
              {{ (goalPts - wallet.totalPoints()) | number }} more points to go
            </div>
            <div class="goal-complete" *ngIf="goalPct() >= 100">
              🎉 You have enough points!
            </div>
          </div>
        </ng-container>
      </div>

      <!-- Next Milestone -->
      <div class="milestone-card" *ngIf="nextMilestone() as m">
        <div class="milestone-icon">{{ m.tripType === 'flight' ? '✈' : '🏨' }}</div>
        <div class="milestone-body">
          <div class="milestone-label">Next milestone</div>
          <div class="milestone-name">{{ m.name }}</div>
          <div class="milestone-bar-wrap">
            <div class="milestone-bar" [style.width]="m.pct + '%'"></div>
          </div>
          <div class="milestone-stat">
            {{ m.pct }}% there · {{ m.gap | number }} pts to go
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="summary" *ngIf="wallet.hasAnyPoints(); else noPoints">
        <div class="summary-label">Estimated Total Value</div>
        <div class="summary-value">\${{ wallet.estimatedValue() | number }}</div>
        <div class="summary-sub">{{ wallet.totalPoints() | number }} total points · blended ~1.6¢/pt</div>

        <!-- Sparkline — only shown when there are at least 2 history entries -->
        <div class="sparkline-wrap" *ngIf="sparklinePoints()">
          <span class="sparkline-label">30-day trend</span>
          <svg class="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none">
            <polyline [attr.points]="sparklinePoints()!" fill="none" stroke="currentColor"
              stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="summary-note">
          This is a conservative blended estimate. Optimal transfers can yield 2–3× more.
          Use the Optimizer to find your best redemption.
        </div>
        <div class="action-row">
          <button class="action-btn" (click)="exportCsv()">↓ Export CSV</button>
          <button class="action-btn share-btn" (click)="copyShare()" [class.copied]="copied()">
            {{ copied() ? '✓ Copied!' : '📋 Share' }}
          </button>
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

    /* Quick-add increments */
    .quick-add {
      display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .qa-btn {
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2);
      border-radius: 6px; color: var(--tally-green);
      font-family: 'Geist Mono', monospace; font-size: 9px; letter-spacing: 0.06em;
      padding: 3px 7px; cursor: pointer; transition: background 0.12s;
    }
    .qa-btn:hover { background: rgba(26,122,74,0.15); }

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

    /* Goal tracker */
    .goal-section { padding: 4px 0 8px; }
    .goal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .goal-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.15em; text-transform: uppercase; color: var(--text3);
    }
    .goal-toggle {
      background: none; border: 1px solid var(--border2); border-radius: 7px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; padding: 3px 9px; cursor: pointer; transition: all 0.15s;
    }
    .goal-toggle:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .goal-inputs { display: flex; gap: 8px; margin-bottom: 12px; }
    .goal-name-input {
      flex: 1; background: var(--white); border: 1.5px solid var(--border2);
      border-radius: 9px; font-family: 'Geist', sans-serif; font-size: 13px;
      color: var(--text); padding: 8px 10px; outline: none; transition: border-color 0.15s;
    }
    .goal-name-input:focus { border-color: var(--tally-green); }
    .goal-name-input::placeholder { color: var(--text3); }
    .goal-pts-input {
      width: 90px; background: var(--white); border: 1.5px solid var(--border2);
      border-radius: 9px; font-family: 'Geist Mono', monospace; font-size: 13px;
      color: var(--tally-green); padding: 8px 10px; outline: none;
      text-align: right; transition: border-color 0.15s; -moz-appearance: textfield;
    }
    .goal-pts-input::-webkit-outer-spin-button,
    .goal-pts-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .goal-pts-input:focus { border-color: var(--tally-green); }
    .goal-bar-wrap { height: 6px; background: var(--border); border-radius: 99px; overflow: hidden; margin-bottom: 8px; }
    .goal-bar {
      height: 100%; background: var(--border2); border-radius: 99px;
      transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1);
    }
    .goal-bar.complete { background: var(--tally-green); }
    .goal-stat {
      display: flex; align-items: baseline; gap: 3px;
      font-family: 'Geist Mono', monospace; font-size: 12px; margin-bottom: 4px;
    }
    .goal-have { color: var(--text); font-weight: 600; }
    .goal-have.complete { color: var(--tally-green); }
    .goal-sep { color: var(--text3); }
    .goal-need { color: var(--text3); flex: 1; }
    .goal-pct { color: var(--text3); }
    .goal-pct.complete { color: var(--tally-green); font-weight: 700; }
    .goal-remaining {
      font-family: 'Geist Mono', monospace; font-size: 10px; color: var(--text3); letter-spacing: 0.06em;
    }
    .goal-complete {
      font-family: 'Geist', sans-serif; font-size: 13px; color: var(--tally-green); font-weight: 600;
    }

    /* Sparkline */
    .sparkline-wrap {
      display: flex; align-items: center; gap: 8px; margin: 10px 0 14px;
      color: var(--tally-green);
    }
    .sparkline-label {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.12em; text-transform: uppercase; color: var(--text3);
      white-space: nowrap;
    }
    .sparkline { flex: 1; height: 28px; }

    /* Action row */
    .action-row { display: flex; gap: 8px; margin-top: 14px; justify-content: center; }
    .action-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.1em; padding: 6px 14px; cursor: pointer;
      transition: all 0.15s; flex: 1; max-width: 140px;
    }
    .action-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .action-btn.share-btn.copied { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }

    /* Next Milestone */
    .milestone-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--white); border: 1px solid var(--border);
      border-radius: 14px; padding: 14px 16px;
      margin: 0 0 20px;
    }
    .milestone-icon { font-size: 22px; flex-shrink: 0; }
    .milestone-body { flex: 1; min-width: 0; }
    .milestone-label {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.14em; text-transform: uppercase; color: var(--text3); margin-bottom: 2px;
    }
    .milestone-name { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 8px; }
    .milestone-bar-wrap { height: 5px; background: var(--border); border-radius: 99px; overflow: hidden; margin-bottom: 5px; }
    .milestone-bar { height: 100%; background: var(--tally-green); border-radius: 99px; transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1); }
    .milestone-stat { font-family: 'Geist Mono', monospace; font-size: 9px; color: var(--text3); letter-spacing: 0.05em; }

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
  private optimizer = inject(OptimizerService);
  private _allRecs = this.optimizer.getAllRecs();

  expandedCard = signal<string | null>(null);
  readonly quickIncrements = [5_000, 10_000, 25_000, 50_000, 100_000];

  // Goal tracker
  showGoal = signal(false);
  goalName = '';
  goalPts = 0;

  readonly goalPct = computed(() => {
    if (!this.goalPts) return 0;
    return Math.min(100, Math.round((this.wallet.totalPoints() / this.goalPts) * 100));
  });

  copied = signal(false);

  /** SVG polyline points string for the 30-day sparkline, or null if < 2 entries */
  readonly sparklinePoints = computed((): string | null => {
    const h = this.wallet.history();
    if (h.length < 2) return null;
    const totals = h.map(e => e.total);
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    const range = max - min || 1;
    const n = totals.length;
    const pts = totals.map((t, i) => {
      const x = Math.round((i / (n - 1)) * 100);
      const y = Math.round(28 - ((t - min) / range) * 22 - 3); // 3px top padding
      return `${x},${y}`;
    });
    return pts.join(' ');
  });

  /** Best balance across a set of card IDs */
  private bestBalance(cardIds: string[]): number {
    return Math.max(0, ...cardIds.map(id => this.wallet.getBalance(id)));
  }

  /** Closest partially-funded redemption, or null */
  readonly nextMilestone = computed(() => {
    if (!this.wallet.hasAnyPoints()) return null;

    let best: { name: string; gap: number; pct: number; cpp: number; tripType: string } | null = null;
    for (const rec of this._allRecs) {
      const needed = rec.ptsRequired ?? rec.ptsBase;
      const have = this.bestBalance(rec.cards);
      if (have <= 0 || have >= needed) continue; // skip zero and already-covered
      const gap = needed - have;
      const pct = Math.round((have / needed) * 100);
      if (!best || gap < best.gap) {
        best = { name: rec.program, gap, pct, cpp: rec.cpp, tripType: rec.tripType };
      }
    }
    return best;
  });

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

  toggleExpand(cardId: string): void {
    this.expandedCard.update(cur => (cur === cardId ? null : cardId));
  }

  quickAdd(cardId: string, amount: number): void {
    this.wallet.setBalance(cardId, this.wallet.getBalance(cardId) + amount);
  }

  formatInc(n: number): string {
    return n >= 1_000 ? `${n / 1_000}k` : `${n}`;
  }

  onInput(cardId: string, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value) || 0;
    this.wallet.setBalance(cardId, val);
  }

  copyShare(): void {
    const lines: string[] = ['My Tally Points Wallet:'];
    for (const card of this.data.cards) {
      const balance = this.wallet.getBalance(card.id);
      if (balance <= 0) continue;
      lines.push(`  ${card.name}: ${balance.toLocaleString()}`);
    }
    lines.push('');
    lines.push(`Total: ${this.wallet.totalPoints().toLocaleString()} pts`);
    lines.push(`Est. value: ~\$${this.wallet.estimatedValue().toLocaleString()}`);
    lines.push('via Tally Points Advisor');

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }).catch(() => {/* clipboard unavailable — silent fail */});
  }

  exportCsv(): void {
    const rows: string[] = ['Program,Category,Balance,Estimated Value ($)'];
    for (const card of this.data.cards) {
      const balance = this.wallet.getBalance(card.id);
      if (balance <= 0) continue;
      const value = this.rowValue(card);
      const category = card.category.charAt(0).toUpperCase() + card.category.slice(1);
      rows.push(`"${card.name}","${category}",${balance},${value}`);
    }
    // Totals row
    rows.push(`"TOTAL","",${this.wallet.totalPoints()},${this.wallet.estimatedValue()}`);

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tally-wallet-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

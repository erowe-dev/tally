import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { WalletService } from '../../core/services/wallet.service';
import { CreditCard } from '../../core/models';

type CatFilter = 'all' | 'transferable' | 'airline' | 'hotel';

@Component({
  selector: 'tally-cards',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content">
      <div class="section-eyebrow">Programs & Partners</div>
      <h2 class="section-title">Transfer <em>partners</em><br>at a glance</h2>

      <!-- Search -->
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          class="search-input"
          type="search"
          placeholder="Search programs or partners…"
          [(ngModel)]="searchRaw"
          autocomplete="off"
        />
        <button class="search-clear" *ngIf="searchRaw" (click)="searchRaw = ''">✕</button>
      </div>

      <!-- Category tabs + great toggle -->
      <div class="filter-row">
        <button *ngFor="let f of catFilters" class="filter-btn"
          [class.active]="activeCat() === f.id"
          (click)="activeCat.set(f.id)">
          {{ f.label }}
        </button>
        <button class="filter-btn great-toggle" [class.active]="greatOnly()"
          (click)="greatOnly.set(!greatOnly())">
          ✦ Great only
        </button>
      </div>

      <div class="count-line">
        {{ filteredCards().length }} program{{ filteredCards().length !== 1 ? 's' : '' }}
      </div>

      <div class="cards-list">
        <div class="cc-card" *ngFor="let card of filteredCards()"
          [class.expanded]="isExpanded(card.id)">
          <button class="cc-header" (click)="toggleCard(card.id)">
            <div class="cc-badge" [style.background]="card.color">{{ card.icon }}</div>
            <div class="cc-meta">
              <div class="cc-name">{{ card.name }}</div>
              <div class="cc-cards">{{ card.cards.join(' · ') }}</div>
              <!-- Wallet balance indicator -->
              <div class="cc-balance" *ngIf="wallet.getBalance(card.id) > 0">
                {{ wallet.getBalance(card.id) | number }} pts
              </div>
            </div>
            <div class="cc-right">
              <div class="cc-best">
                <div class="cc-best-val">{{ getBestCpp(card) }}¢</div>
                <div class="cc-best-label">best cpp</div>
              </div>
              <span class="cc-chevron">{{ isExpanded(card.id) ? '▲' : '▼' }}</span>
            </div>
          </button>
          <div class="partners" *ngIf="isExpanded(card.id)">
            <div class="partner-wrap"
              *ngFor="let p of visiblePartners(card)"
              [class.dimmed]="greatOnly() && p.quality !== 'great'">
              <button class="partner-row"
                (click)="togglePartnerDetail(card.id, p.name)">
                <span class="p-icon">{{ p.icon }}</span>
                <span class="p-name">{{ p.name }}</span>
                <span class="p-ratio" [class.great]="p.quality === 'great'" [class.good]="p.quality === 'good'">
                  {{ p.ratio }} · ~{{ p.cpp }}¢
                </span>
                <span class="p-expand-icon">{{ isPartnerExpanded(card.id, p.name) ? '▲' : '▼' }}</span>
              </button>
              <!-- Transfer detail row -->
              <div class="transfer-detail" *ngIf="isPartnerExpanded(card.id, p.name)">
                <ng-container *ngIf="wallet.getBalance(card.id) > 0; else noBalance">
                  <div class="td-chain">
                    <span class="td-amount">{{ wallet.getBalance(card.id) | number }}</span>
                    <span class="td-prog">{{ card.short }}</span>
                    <span class="td-arrow">→</span>
                    <span class="td-amount result">{{ transferResult(wallet.getBalance(card.id), p.ratio) | number }}</span>
                    <span class="td-prog">{{ p.name }}</span>
                  </div>
                  <div class="td-value">
                    Est. value: ~\${{ transferValue(wallet.getBalance(card.id), p.ratio, p.cpp) | number }}
                    at {{ p.cpp }}¢/pt
                  </div>
                </ng-container>
                <ng-template #noBalance>
                  <div class="td-no-bal">Add your {{ card.short }} balance in Wallet to see transfer math.</div>
                </ng-template>
              </div>
            </div>
            <div class="no-partners" *ngIf="visiblePartners(card).length === 0">
              No partners match.
            </div>
          </div>
        </div>
      </div>

      <div class="empty-filter" *ngIf="filteredCards().length === 0">
        <p>No programs match your filters.</p>
        <button class="link-btn" (click)="clearAll()">Clear filters</button>
      </div>

      <!-- Rate My Redemption -->
      <div class="calc-section">
        <button class="calc-toggle" (click)="showRater.set(!showRater())">
          <span>🎯 Rate My Redemption</span>
          <span class="calc-chevron">{{ showRater() ? '▲' : '▼' }}</span>
        </button>
        <div class="calc-body" *ngIf="showRater()">
          <div class="rater-inputs">
            <div class="calc-input-wrap">
              <label class="calc-label">Points used</label>
              <input class="calc-input" type="number" inputmode="numeric"
                [(ngModel)]="raterPts" placeholder="60000" min="0" step="1000">
            </div>
            <div class="calc-input-wrap">
              <label class="calc-label">Cash value received ($)</label>
              <input class="calc-input" type="number" inputmode="decimal"
                [(ngModel)]="raterCash" placeholder="900" min="0" step="10">
            </div>
          </div>
          <div class="rater-result" *ngIf="raterCpp() !== null">
            <div class="rater-cpp" [class]="raterGrade()">{{ raterCpp() | number:'1.2-2' }}¢</div>
            <div class="rater-label">per point</div>
            <div class="rater-grade" [class]="raterGrade()">{{ raterGradeLabel() }}</div>
            <div class="rater-note">{{ raterNote() }}</div>
          </div>
        </div>
      </div>

      <!-- CPP Calculator -->
      <div class="calc-section" style="margin-top:10px">
        <button class="calc-toggle" (click)="showCalc.set(!showCalc())">
          <span>💡 Points Value Calculator</span>
          <span class="calc-chevron">{{ showCalc() ? '▲' : '▼' }}</span>
        </button>
        <div class="calc-body" *ngIf="showCalc()">
          <div class="calc-input-wrap">
            <label class="calc-label">How many points?</label>
            <input class="calc-input" type="number" inputmode="numeric"
              [(ngModel)]="calcPts" placeholder="50000" min="0" step="1000">
          </div>
          <div class="calc-grid" *ngIf="calcPts > 0">
            <div class="calc-row" *ngFor="let tier of calcTiers"
              [class.calc-best]="tier === bestTier()">
              <span class="calc-cpp">{{ tier }}¢</span>
              <span class="calc-cpp-label">per point</span>
              <span class="calc-val">\${{ calcValue(tier) | number }}</span>
              <span class="calc-rating" [class.great]="tier >= 2.5" [class.good]="tier >= 1.5">
                {{ tierLabel(tier) }}
              </span>
            </div>
          </div>
          <div class="calc-note" *ngIf="calcPts > 0">
            Best partners can reach 3¢+ per point. Use the Optimizer to find your specific redemption.
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    /* Search */
    .search-wrap {
      position: relative; display: flex; align-items: center;
      background: var(--white); border: 1.5px solid var(--border2);
      border-radius: 12px; padding: 0 12px; gap: 8px;
      margin-bottom: 12px; transition: border-color 0.15s;
    }
    .search-wrap:focus-within { border-color: var(--tally-green); }
    .search-icon { font-size: 14px; flex-shrink: 0; opacity: 0.5; }
    .search-input {
      flex: 1; border: none; background: transparent; outline: none;
      font-family: 'Geist', sans-serif; font-size: 14px; color: var(--text);
      padding: 11px 0;
    }
    .search-input::placeholder { color: var(--text3); }
    .search-input::-webkit-search-cancel-button { display: none; }
    .search-clear {
      background: none; border: none; cursor: pointer; padding: 4px;
      font-size: 12px; color: var(--text3); line-height: 1;
    }

    /* Filter row */
    .filter-row {
      display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;
    }
    .filter-btn {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 5px 13px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.08em; color: var(--text3); cursor: pointer;
      transition: all 0.15s;
    }
    .filter-btn.active {
      background: var(--tally-green); border-color: var(--tally-green);
      color: white;
    }
    .great-toggle.active {
      background: var(--tally-amber, #d97706); border-color: var(--tally-amber, #d97706);
    }

    /* Count */
    .count-line {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); letter-spacing: 0.08em; margin-bottom: 16px;
    }

    /* Cards */
    .cards-list { display: flex; flex-direction: column; gap: 14px; }
    .cc-card { background: var(--white); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }
    .cc-card.expanded { border-color: var(--tally-green); }

    .cc-header {
      width: 100%; background: none; border: none; cursor: pointer;
      padding: 16px 18px; display: flex; align-items: center; gap: 14px;
      -webkit-tap-highlight-color: transparent; text-align: left;
    }
    .cc-header:hover { background: var(--surface); }
    .cc-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .cc-chevron {
      font-size: 8px; color: var(--text3); transition: transform 0.2s; line-height: 1;
    }
    .cc-badge {
      width: 46px; height: 30px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; flex-shrink: 0;
    }
    .cc-meta { flex: 1; min-width: 0; }
    .cc-name { font-size: 14px; font-weight: 600; color: var(--text); }
    .cc-cards {
      font-size: 10px; color: var(--text3);
      font-family: 'Geist Mono', monospace; letter-spacing: 0.04em;
      margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cc-balance {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--tally-green); letter-spacing: 0.04em; margin-top: 2px;
    }

    .cc-best { text-align: right; }
    .cc-best-val { font-family: 'Geist Mono', monospace; font-size: 16px; color: var(--tally-green); }
    .cc-best-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); letter-spacing: 0.1em; text-transform: uppercase;
    }

    .partners { padding: 12px 18px; display: flex; flex-direction: column; gap: 4px; }
    .partner-wrap { transition: opacity 0.2s; border-radius: 8px; overflow: hidden; }
    .partner-wrap.dimmed { opacity: 0.28; }
    .partner-row {
      display: flex; align-items: center; gap: 10px;
      width: 100%; background: none; border: none; cursor: pointer;
      padding: 6px 0; text-align: left;
      -webkit-tap-highlight-color: transparent;
    }
    .partner-row:hover { background: var(--surface); border-radius: 6px; }
    .p-icon { font-size: 15px; width: 22px; text-align: center; flex-shrink: 0; }
    .p-name { flex: 1; font-size: 12px; color: var(--text); font-weight: 500; }
    .p-ratio { font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--text3); white-space: nowrap; }
    .p-ratio.great { color: var(--tally-green); }
    .p-ratio.good  { color: var(--tally-amber, #d97706); }
    .p-expand-icon { font-size: 7px; color: var(--border2); flex-shrink: 0; }

    /* Transfer detail */
    .transfer-detail {
      background: var(--surface); border-radius: 8px; padding: 9px 12px; margin: 2px 0 6px;
    }
    .td-chain {
      display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;
    }
    .td-amount {
      font-family: 'Geist Mono', monospace; font-size: 12px; color: var(--text); font-weight: 600;
    }
    .td-amount.result { color: var(--tally-green); }
    .td-prog { font-family: 'Geist Mono', monospace; font-size: 9px; color: var(--text3); }
    .td-arrow { color: var(--tally-green); font-size: 13px; }
    .td-value { font-size: 11px; color: var(--text2); line-height: 1.4; }
    .td-no-bal { font-size: 11px; color: var(--text3); font-style: italic; }

    .no-partners {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); letter-spacing: 0.06em; padding: 4px 0; font-style: italic;
    }

    .empty-filter { text-align: center; padding: 40px 16px; color: var(--text3); font-size: 14px; }
    .link-btn {
      background: none; border: none; cursor: pointer;
      color: var(--tally-green); font-size: 14px; padding: 8px;
      text-decoration: underline; text-underline-offset: 3px;
    }

    /* Rate My Redemption */
    .rater-inputs { display: flex; gap: 8px; margin-bottom: 14px; }
    .rater-inputs .calc-input-wrap { flex: 1; margin-bottom: 0; }
    .rater-result { text-align: center; padding: 12px 0 4px; }
    .rater-cpp {
      font-family: 'Instrument Serif', serif; font-size: 44px;
      line-height: 1; color: var(--text);
    }
    .rater-cpp.great { color: var(--tally-green); }
    .rater-cpp.good  { color: var(--tally-amber, #d97706); }
    .rater-cpp.bad   { color: var(--text3); }
    .rater-label {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); letter-spacing: 0.1em; text-transform: uppercase;
      margin-bottom: 8px;
    }
    .rater-grade {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
      padding: 3px 10px; border-radius: 4px; display: inline-block; margin-bottom: 10px;
    }
    .rater-grade.great { background: var(--tally-green-light); color: var(--tally-green); }
    .rater-grade.good  { background: rgba(251,191,36,0.15); color: var(--tally-amber, #d97706); }
    .rater-grade.bad   { background: var(--surface); color: var(--text3); }
    .rater-note { font-size: 12px; color: var(--text2); line-height: 1.5; font-style: italic; }

    /* CPP Calculator */
    .calc-section { margin-top: 20px; }
    .calc-toggle {
      width: 100%; background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 13px 16px; cursor: pointer;
      display: flex; align-items: center; justify-content: space-between;
      font-family: 'Geist', sans-serif; font-size: 13px; color: var(--text2);
      transition: border-color 0.15s; -webkit-tap-highlight-color: transparent;
    }
    .calc-toggle:hover { border-color: var(--tally-green); }
    .calc-chevron { font-size: 8px; color: var(--text3); }
    .calc-body {
      background: var(--white); border: 1px solid var(--border);
      border-top: none; border-radius: 0 0 12px 12px;
      padding: 16px;
    }
    .calc-input-wrap { margin-bottom: 14px; }
    .calc-label {
      display: block; font-family: 'Geist Mono', monospace;
      font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--text3); margin-bottom: 6px;
    }
    .calc-input {
      width: 100%; background: var(--surface); border: 1.5px solid var(--border2);
      border-radius: 9px; color: var(--tally-green);
      font-family: 'Geist Mono', monospace; font-size: 15px;
      padding: 9px 12px; outline: none; box-sizing: border-box;
      transition: border-color 0.15s; -moz-appearance: textfield;
    }
    .calc-input::-webkit-outer-spin-button,
    .calc-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .calc-input:focus { border-color: var(--tally-green); }
    .calc-grid { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
    .calc-row {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 9px; padding: 9px 12px; transition: border-color 0.15s;
    }
    .calc-row.calc-best { border-color: var(--tally-green); background: var(--tally-green-light); }
    .calc-cpp {
      font-family: 'Geist Mono', monospace; font-size: 15px;
      font-weight: 600; color: var(--text); min-width: 32px;
    }
    .calc-cpp-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); flex: 1; letter-spacing: 0.06em;
    }
    .calc-val {
      font-family: 'Geist Mono', monospace; font-size: 16px;
      color: var(--tally-green); font-weight: 600;
    }
    .calc-rating {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--text3); min-width: 52px; text-align: right;
    }
    .calc-rating.great { color: var(--tally-green); }
    .calc-rating.good  { color: var(--tally-amber, #d97706); }
    .calc-note {
      font-size: 11px; color: var(--text3); line-height: 1.5; font-style: italic;
    }
  `]
})
export class CardsComponent {
  data = inject(DataService);
  wallet = inject(WalletService);

  // Two-way bound to ngModel; signal reads it via computed
  searchRaw = '';

  activeCat = signal<CatFilter>('all');
  greatOnly = signal(false);

  // Accordion: set of expanded card ids
  expandedCards = signal<Set<string>>(new Set());

  readonly catFilters: { id: CatFilter; label: string }[] = [
    { id: 'all',          label: 'All' },
    { id: 'transferable', label: '↔ Transferable' },
    { id: 'airline',      label: '✈ Airline' },
    { id: 'hotel',        label: '🏨 Hotel' },
  ];

  readonly filteredCards = computed<CreditCard[]>(() => {
    const q = this.searchRaw.toLowerCase().trim();
    const cat = this.activeCat();
    const great = this.greatOnly();

    return this.data.cards.filter(card => {
      if (cat !== 'all' && card.category !== cat) return false;

      // Search: match program name, card names, or any partner name
      if (q) {
        const nameMatch =
          card.name.toLowerCase().includes(q) ||
          card.cards.some(c => c.toLowerCase().includes(q));
        const partnerMatch = card.partners.some(p =>
          p.name.toLowerCase().includes(q),
        );
        if (!nameMatch && !partnerMatch) return false;
      }

      // Great-only: card must have at least one great partner
      if (great && !card.partners.some(p => p.quality === 'great')) return false;

      return true;
    });
  });

  /** Partners to display for a card — filtered when search targets partner names */
  visiblePartners(card: CreditCard) {
    const q = this.searchRaw.toLowerCase().trim();
    if (!q) return card.partners;

    // If the search matches the program itself, show all partners
    const programMatch =
      card.name.toLowerCase().includes(q) ||
      card.cards.some(c => c.toLowerCase().includes(q));
    if (programMatch) return card.partners;

    // Otherwise narrow to matching partners
    return card.partners.filter(p => p.name.toLowerCase().includes(q));
  }

  getBestCpp(card: CreditCard): number {
    return Math.max(...card.partners.map(p => p.cpp));
  }

  isExpanded(cardId: string): boolean {
    return this.expandedCards().has(cardId);
  }

  toggleCard(cardId: string): void {
    this.expandedCards.update(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }

  clearAll(): void {
    this.searchRaw = '';
    this.activeCat.set('all');
    this.greatOnly.set(false);
  }

  // Partner detail expand/collapse
  private _expandedPartner = signal<string | null>(null); // key: `${cardId}|${partnerName}`

  isPartnerExpanded(cardId: string, partnerName: string): boolean {
    return this._expandedPartner() === `${cardId}|${partnerName}`;
  }

  togglePartnerDetail(cardId: string, partnerName: string): void {
    const key = `${cardId}|${partnerName}`;
    this._expandedPartner.update(cur => cur === key ? null : key);
  }

  /** Parse ratio string like "1:2" and compute result miles from balance */
  transferResult(balance: number, ratio: string): number {
    const [from, to] = ratio.split(':').map(Number);
    if (!from || !to) return balance;
    return Math.round(balance * (to / from));
  }

  /** Estimated dollar value after transfer */
  transferValue(balance: number, ratio: string, cpp: number): number {
    return Math.round(this.transferResult(balance, ratio) * cpp / 100);
  }

  // Rate My Redemption
  showRater = signal(false);
  raterPts = 0;
  raterCash = 0;

  readonly raterCpp = computed((): number | null => {
    if (!this.raterPts || !this.raterCash) return null;
    return Math.round((this.raterCash / this.raterPts) * 10000) / 100;
  });

  readonly raterGrade = computed((): 'great' | 'good' | 'bad' => {
    const c = this.raterCpp();
    if (c === null) return 'bad';
    if (c >= 2.0) return 'great';
    if (c >= 1.2) return 'good';
    return 'bad';
  });

  readonly raterGradeLabel = computed((): string => {
    const c = this.raterCpp();
    if (c === null) return '';
    if (c >= 3.0)  return '🏆 Exceptional';
    if (c >= 2.0)  return '✅ Great redemption';
    if (c >= 1.2)  return '👍 Decent redemption';
    if (c >= 0.8)  return '😐 Below average';
    return '❌ Poor redemption';
  });

  readonly raterNote = computed((): string => {
    const c = this.raterCpp();
    if (c === null) return '';
    if (c >= 3.0)  return 'World-class! You maximized a premium transfer partner redemption.';
    if (c >= 2.0)  return 'Solid. You\'re well above the 1.6¢ blended average.';
    if (c >= 1.2)  return 'Reasonable — better than cash-back but not elite. Consider premium cabins next time.';
    if (c >= 0.8)  return 'You might have done better redeeming for travel directly. Check partner CPP values.';
    return 'Consider transferring to a premium partner for your next redemption instead.';
  });

  // CPP Calculator
  showCalc = signal(false);
  calcPts = 0;
  readonly calcTiers = [1.0, 1.5, 2.0, 2.5, 3.0];

  calcValue(cpp: number): number {
    return Math.round(this.calcPts * cpp / 100);
  }

  readonly bestTier = computed(() => {
    // Highlight the "great" floor — 2.5¢ is where elite redemptions start
    return 2.5;
  });

  tierLabel(cpp: number): string {
    if (cpp >= 2.5) return 'Great';
    if (cpp >= 1.5) return 'Good';
    return 'Basic';
  }
}

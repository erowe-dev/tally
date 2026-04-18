import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
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
            <div class="partner-row"
              *ngFor="let p of visiblePartners(card)"
              [class.dimmed]="greatOnly() && p.quality !== 'great'"
            >
              <span class="p-icon">{{ p.icon }}</span>
              <span class="p-name">{{ p.name }}</span>
              <span class="p-ratio" [class.great]="p.quality === 'great'" [class.good]="p.quality === 'good'">
                {{ p.ratio }} · ~{{ p.cpp }}¢
              </span>
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
    .cc-best { text-align: right; }
    .cc-best-val { font-family: 'Geist Mono', monospace; font-size: 16px; color: var(--tally-green); }
    .cc-best-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); letter-spacing: 0.1em; text-transform: uppercase;
    }

    .partners { padding: 12px 18px; display: flex; flex-direction: column; gap: 8px; }
    .partner-row { display: flex; align-items: center; gap: 10px; transition: opacity 0.2s; }
    .partner-row.dimmed { opacity: 0.28; }
    .p-icon { font-size: 15px; width: 22px; text-align: center; flex-shrink: 0; }
    .p-name { flex: 1; font-size: 12px; color: var(--text); font-weight: 500; }
    .p-ratio { font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--text3); white-space: nowrap; }
    .p-ratio.great { color: var(--tally-green); }
    .p-ratio.good  { color: var(--tally-amber, #d97706); }

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
  `]
})
export class CardsComponent {
  data = inject(DataService);

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
}

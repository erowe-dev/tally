import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { SweetSpot, TransferBonus } from '../../core/models';

type Filter = 'all' | 'flight' | 'hotel' | 'promo' | 'saved';
type SortMode = 'default' | 'cpp' | 'pts';
const FAV_KEY = 'tally_sweetspot_favs_v1';

@Component({
  selector: 'tally-sweetspots',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content">
      <div class="section-eyebrow">Known Sweet Spots</div>
      <h2 class="section-title"><em>Hidden</em> value<br>redemptions</h2>

      <!-- Search -->
      <div class="spot-search-wrap">
        <span class="spot-search-icon">🔍</span>
        <input class="spot-search-input" type="search" placeholder="Search sweet spots…"
          [(ngModel)]="searchRaw" autocomplete="off">
        <button class="spot-search-clear" *ngIf="searchRaw" (click)="searchRaw = ''">✕</button>
      </div>

      <!-- Transfer Bonuses strip -->
      <div class="bonuses-section" *ngIf="activeTransferBonuses().length > 0">
        <div class="bonuses-label">⚡ Active Transfer Bonuses</div>
        <div class="bonuses-strip">
          <div class="bonus-card" *ngFor="let b of activeTransferBonuses()">
            <div class="bonus-header">
              <span class="bonus-from">{{ b.from }}</span>
              <span class="bonus-arrow">→</span>
              <span class="bonus-to-icon">{{ b.toIcon }}</span>
              <span class="bonus-pct">{{ b.bonus }}</span>
            </div>
            <div class="bonus-to">{{ b.to }}</div>
            <div class="bonus-expires">Expires {{ formatExpiry(b.expires) }}</div>
            <p class="bonus-note">{{ b.note }}</p>
          </div>
        </div>
      </div>

      <!-- Filter tabs -->
      <div class="filter-row">
        <button *ngFor="let f of filters" class="filter-btn"
          [class.active]="activeFilter() === f.id"
          (click)="activeFilter.set(f.id)">
          {{ f.label }}
          <span class="fav-count" *ngIf="f.id === 'saved' && favCount() > 0">{{ favCount() }}</span>
        </button>
      </div>

      <!-- Sort row -->
      <div class="sort-row">
        <span class="sort-label">Sort:</span>
        <button *ngFor="let s of sortModes" class="sort-btn"
          [class.active]="activeSort() === s.id"
          (click)="activeSort.set(s.id)">
          {{ s.label }}
        </button>
      </div>

      <div class="count-line">{{ filtered().length }} spot{{ filtered().length !== 1 ? 's' : '' }}</div>

      <div class="spots-list">
        <div class="spot-card" *ngFor="let s of filtered()" [class]="'cat-' + s.category">
          <button class="fav-btn" (click)="toggleFav(spotKey(s))"
            [class.active]="isFav(spotKey(s))"
            [title]="isFav(spotKey(s)) ? 'Remove from saved' : 'Save this spot'">
            {{ isFav(spotKey(s)) ? '★' : '☆' }}
          </button>
          <div class="category-badge">{{ categoryLabel(s.category) }}</div>
          <div class="spot-route" [innerHTML]="formatRoute(s.route)"></div>
          <div class="spot-detail">{{ s.detail.toUpperCase() }}</div>
          <div class="spot-stats">
            <div class="stat">
              <span class="stat-val">{{ s.ptsNeeded }}</span>
              <span class="stat-label">Points</span>
            </div>
            <div class="stat">
              <span class="stat-val">{{ s.estCash }}</span>
              <span class="stat-label">Cash Value</span>
            </div>
            <div class="stat">
              <span class="stat-val cpp">{{ s.cpp }}</span>
              <span class="stat-label">Est. CPP</span>
            </div>
          </div>
          <p class="spot-note">{{ s.note }}</p>
          <div class="spot-chips">
            <span class="chip card-chip" *ngFor="let c of s.cards">{{ c }}</span>
            <span class="chip prog-chip" *ngFor="let p of s.programs">{{ p }}</span>
          </div>
        </div>
      </div>

      <div class="empty-filter" *ngIf="filtered().length === 0">
        <p>{{ activeFilter() === 'saved' ? 'No saved spots yet — star a spot to save it.' : searchRaw ? 'No spots match your search.' : 'No spots match this filter.' }}</p>
        <button class="spot-clear-btn" *ngIf="searchRaw" (click)="searchRaw = ''">Clear search</button>
      </div>
    </div>
  `,
  styles: [`
    /* Search */
    .spot-search-wrap {
      display: flex; align-items: center; gap: 8px;
      background: var(--white); border: 1.5px solid var(--border2);
      border-radius: 12px; padding: 0 12px; margin-bottom: 16px;
      transition: border-color 0.15s;
    }
    .spot-search-wrap:focus-within { border-color: var(--tally-green); }
    .spot-search-icon { font-size: 14px; opacity: 0.5; flex-shrink: 0; }
    .spot-search-input {
      flex: 1; border: none; background: transparent; outline: none;
      font-family: 'Geist', sans-serif; font-size: 14px; color: var(--text);
      padding: 11px 0;
    }
    .spot-search-input::placeholder { color: var(--text3); }
    .spot-search-input::-webkit-search-cancel-button { display: none; }
    .spot-search-clear {
      background: none; border: none; cursor: pointer; padding: 4px;
      font-size: 12px; color: var(--text3); line-height: 1;
    }

    /* Transfer bonuses strip */
    .bonuses-section { margin-bottom: 20px; }
    .bonuses-label {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.12em; color: var(--tally-amber, #d97706);
      text-transform: uppercase; margin-bottom: 10px;
    }
    .bonuses-strip {
      display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;
      scrollbar-width: none;
    }
    .bonuses-strip::-webkit-scrollbar { display: none; }
    .bonus-card {
      background: var(--white); border: 1px solid rgba(217,119,6,0.25);
      border-radius: 12px; padding: 12px 14px; min-width: 220px; flex-shrink: 0;
      border-top: 2px solid var(--tally-amber, #d97706);
    }
    .bonus-header {
      display: flex; align-items: center; gap: 6px; margin-bottom: 3px;
    }
    .bonus-from { font-family: 'Geist Mono', monospace; font-size: 10px; color: var(--text3); }
    .bonus-arrow { color: var(--tally-amber, #d97706); font-size: 11px; }
    .bonus-to-icon { font-size: 14px; }
    .bonus-pct {
      font-family: 'Geist Mono', monospace; font-size: 12px; font-weight: 700;
      color: var(--tally-amber, #d97706); margin-left: auto;
    }
    .bonus-to { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .bonus-expires {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--tally-red, #dc2626); letter-spacing: 0.06em; margin-bottom: 6px;
    }
    .bonus-note { font-size: 11px; color: var(--text3); line-height: 1.5; }

    .filter-row {
      display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;
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

    .sort-row {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
    }
    .sort-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--text3);
    }
    .sort-btn {
      background: none; border: 1px solid var(--border);
      border-radius: 16px; padding: 3px 10px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; color: var(--text3); cursor: pointer;
      transition: all 0.15s;
    }
    .sort-btn.active { border-color: var(--tally-green); color: var(--tally-green); }

    .count-line {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); letter-spacing: 0.08em; margin-bottom: 16px;
    }

    .spots-list { display: flex; flex-direction: column; gap: 12px; }

    .spot-card {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 14px; padding: 18px;
      position: relative; overflow: hidden;
    }
    .spot-card::before {
      content: ''; position: absolute;
      top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, var(--tally-green), transparent);
    }
    .spot-card.cat-hotel::before { background: linear-gradient(90deg, transparent, var(--tally-amber, #b45309), transparent); }
    .spot-card.cat-promo::before { background: linear-gradient(90deg, transparent, var(--tally-green-mid), transparent); }

    .category-badge {
      position: absolute; top: 14px; right: 14px;
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.12em; text-transform: uppercase;
      padding: 3px 7px; border-radius: 4px;
      background: var(--surface); border: 1px solid var(--border);
      color: var(--text3);
    }

    .spot-route {
      font-family: 'Instrument Serif', serif;
      font-size: 20px; font-weight: 400; color: var(--text); margin-bottom: 4px;
      padding-right: 70px;
    }
    :host ::ng-deep .spot-route .arrow { color: var(--tally-green); font-style: italic; }

    .spot-detail {
      font-family: 'Geist Mono', monospace;
      font-size: 9px; letter-spacing: 0.1em; color: var(--text3); margin-bottom: 14px;
    }
    .spot-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
    .stat {
      background: var(--surface); border-radius: 10px; padding: 10px;
      text-align: center; display: flex; flex-direction: column; gap: 2px;
    }
    .stat-val { font-family: 'Geist Mono', monospace; font-size: 13px; color: var(--tally-green); }
    .stat-val.cpp { color: var(--tally-green-mid); }
    .stat-label {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      color: var(--text3); letter-spacing: 0.1em; text-transform: uppercase;
    }
    .spot-note { font-size: 12px; color: var(--text2); line-height: 1.55; margin-bottom: 12px; }

    .spot-chips { display: flex; gap: 5px; flex-wrap: wrap; }
    .chip {
      border-radius: 6px; padding: 3px 8px;
      font-family: 'Geist Mono', monospace; font-size: 9px; letter-spacing: 0.05em;
    }
    .card-chip { background: var(--surface); border: 1px solid var(--border); color: var(--text2); }
    .prog-chip { background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2); color: var(--tally-green); }

    .empty-filter { text-align: center; padding: 32px 16px; color: var(--text3); font-size: 14px; }
    .spot-clear-btn {
      background: none; border: none; color: var(--tally-green); font-size: 13px;
      cursor: pointer; text-decoration: underline; padding: 8px; margin-top: 4px;
    }

    /* Favorites button on each card */
    .fav-btn {
      position: absolute; top: 12px; left: 14px;
      background: none; border: none; cursor: pointer;
      font-size: 16px; color: var(--border2); line-height: 1;
      padding: 4px; transition: color 0.15s, transform 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .fav-btn:hover { color: var(--tally-amber, #d97706); transform: scale(1.15); }
    .fav-btn.active { color: var(--tally-amber, #d97706); }

    /* Reposition route/badge to account for fav button */
    .spot-route { padding-right: 70px; padding-left: 24px; }
    .category-badge { right: 14px; }

    /* Saved filter count badge */
    .fav-count {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--tally-amber, #d97706); color: white;
      font-family: 'Geist Mono', monospace; font-size: 8px;
      width: 14px; height: 14px; border-radius: 50%; margin-left: 4px;
    }
  `]
})
export class SweetspotsComponent {
  data = inject(DataService);

  searchRaw = '';
  activeFilter = signal<Filter>('all');
  activeSort = signal<SortMode>('default');
  private _favs = signal<Set<string>>(this.loadFavs());

  readonly sortModes: { id: SortMode; label: string }[] = [
    { id: 'default', label: 'Default' },
    { id: 'cpp',     label: '↑ CPP' },
    { id: 'pts',     label: '↑ Points' },
  ];

  readonly favCount = computed(() => this._favs().size);

  readonly filters: { id: Filter; label: string }[] = [
    { id: 'all',    label: 'All' },
    { id: 'flight', label: '✈ Flights' },
    { id: 'hotel',  label: '🏨 Hotels' },
    { id: 'promo',  label: '⚡ Promos' },
    { id: 'saved',  label: '★ Saved' },
  ];

  readonly filtered = computed<SweetSpot[]>(() => {
    const f = this.activeFilter();
    const favs = this._favs();
    const sort = this.activeSort();
    const q = this.searchRaw.toLowerCase().trim();

    let spots: SweetSpot[];
    if (f === 'saved') spots = this.data.sweetSpots.filter(s => favs.has(this.spotKey(s)));
    else if (f === 'all') spots = [...this.data.sweetSpots];
    else spots = this.data.sweetSpots.filter(s => s.category === f);

    // Text search across route, detail, note, programs, cards
    if (q) {
      spots = spots.filter(s =>
        s.route.toLowerCase().includes(q) ||
        s.detail.toLowerCase().includes(q) ||
        s.note.toLowerCase().includes(q) ||
        s.programs.some(p => p.toLowerCase().includes(q)) ||
        s.cards.some(c => c.toLowerCase().includes(q))
      );
    }

    if (sort === 'cpp') {
      spots = [...spots].sort((a, b) => parseFloat(b.cpp) - parseFloat(a.cpp));
    } else if (sort === 'pts') {
      // parse "88,000" → 88000 for comparison
      spots = [...spots].sort((a, b) => {
        const pA = parseInt(a.ptsNeeded.replace(/[^0-9]/g, '')) || 0;
        const pB = parseInt(b.ptsNeeded.replace(/[^0-9]/g, '')) || 0;
        return pA - pB;
      });
    }
    return spots;
  });

  spotKey(s: SweetSpot): string {
    return `${s.category}|${s.route}`;
  }

  isFav(key: string): boolean {
    return this._favs().has(key);
  }

  toggleFav(key: string): void {
    this._favs.update(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      this.saveFavs(next);
      return next;
    });
  }

  private loadFavs(): Set<string> {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  }

  private saveFavs(favs: Set<string>): void {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
    } catch {}
  }

  /** Only show bonuses that haven't expired yet */
  readonly activeTransferBonuses = computed<TransferBonus[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.data.transferBonuses.filter(b => b.expires >= today);
  });

  formatRoute(route: string): string {
    return route.replace('→', '<span class="arrow"> → </span>');
  }

  categoryLabel(cat: SweetSpot['category']): string {
    switch (cat) {
      case 'flight': return '✈ Flight';
      case 'hotel':  return '🏨 Hotel';
      case 'promo':  return '⚡ Promo';
    }
  }

  formatExpiry(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

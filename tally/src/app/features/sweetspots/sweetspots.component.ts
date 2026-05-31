import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { WalletService } from '../../core/services/wallet.service';
import { SweetSpot, TransferBonus } from '../../core/models';
import { NavigationService } from '../../core/services/navigation.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ToastService } from '../../core/services/toast.service';

type Filter = 'all' | 'flight' | 'hotel' | 'promo' | 'new' | 'saved' | 'covered';
type SortMode = 'default' | 'cpp' | 'pts';
const FAV_KEY = 'tally_sweetspot_favs_v1';
const FILTER_KEY = 'tally_sweetspots_filter_v1';
const UI_STATE_KEY = 'tally_sweetspots_ui_v1';
const SEARCH_STATE_KEY = 'tally_sweetspots_search_session_v1';

interface SweetSpotsUiState {
  activeFilter?: Filter;
  activeSort?: SortMode;
  minCppFilter?: number;
}

interface CppTier { val: number; label: string }
const CPP_TIERS: CppTier[] = [
  { val: 0,   label: 'Any' },
  { val: 1.0, label: '>1¢' },
  { val: 1.5, label: '>1.5¢' },
  { val: 2.0, label: '>2¢' },
  { val: 2.5, label: '>2.5¢' },
];

/** Award booking URLs by program name */
const BOOKING_URLS: Partial<Record<string, string>> = {
  'ANA Mileage Club':            'anamileageclub.com',
  'Air Canada Aeroplan':         'aircanada.com',
  'Singapore KrisFlyer':         'singaporeair.com',
  'Virgin Atlantic Flying Club': 'virginatlantic.com',
  'Air France/KLM Flying Blue':  'airfranceklm.com',
  'British Airways Avios':       'britishairways.com/travel/redeem/execclub',
  'Turkish Miles&Smiles':        'turkishairlines.com/en-us/miles-and-smiles/miles-award-tickets',
  'American AAdvantage':         'aa.com/loyalty/home.do',
  'Alaska MileagePlan':          'alaskaair.com/content/flights/award-travel',
  'Southwest Rapid Rewards':     'southwest.com/rapidrewards/rapid-rewards-member-benefits',
  'World of Hyatt':              'hyatt.com/shop/usertrack/rewards/redeem',
  'Marriott Bonvoy':             'marriott.com/loyalty/redeem/hotels/list',
  'Hilton Honors':               'hilton.com/en/hilton-honors/redeem',
  'Avianca LifeMiles':           'lifemiles.com/shop/redeem',
  'United MileagePlus':          'united.com/en/us/book/award-travel',
  'Korean Air SkyPass':          'koreanair.com/skypass',
  'Aeromexico Club Premier':     'aeromexico.com/en-us/club-premier',
  'IHG One Rewards':             'ihg.com/rewardsclub/gb/en/redeem',
};

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
        <input class="spot-search-input" type="search" aria-label="Search sweet spots" placeholder="Search sweet spots…"
          [ngModel]="searchRaw()" (ngModelChange)="searchRaw.set($event)" autocomplete="off">
        <button class="spot-search-clear" *ngIf="searchRaw()" type="button" aria-label="Clear sweet spot search" (click)="searchRaw.set('')">✕</button>
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
      <div class="filter-row" role="radiogroup" aria-label="Sweet spot category filter">
        <button type="button" *ngFor="let f of filters" class="filter-btn"
          role="radio"
          [class.active]="activeFilter() === f.id"
          [attr.aria-checked]="activeFilter() === f.id"
          (click)="activeFilter.set(f.id)">
          {{ f.label }}
          <span class="fav-count" *ngIf="f.id === 'saved' && favCount() > 0">{{ favCount() }}</span>
          <span class="cov-count" *ngIf="f.id === 'covered' && coveredCount() > 0">{{ coveredCount() }}</span>
        </button>
      </div>

      <!-- Sort row -->
      <div class="sort-row" role="radiogroup" aria-label="Sweet spot sort order">
        <span class="sort-label">Sort:</span>
        <button type="button" *ngFor="let s of sortModes" class="sort-btn"
          role="radio"
          [class.active]="activeSort() === s.id"
          [attr.aria-checked]="activeSort() === s.id"
          (click)="activeSort.set(s.id)">
          {{ s.label }}
        </button>
      </div>

      <!-- CPP min filter -->
      <div class="cpp-filter-row">
        <span class="cpp-filter-label">Min CPP:</span>
        <div class="cpp-tiers" role="radiogroup" aria-label="Minimum cents per point filter">
          <button type="button" *ngFor="let t of cppTiers" class="cpp-tier-btn"
            role="radio"
            [class.active]="minCppFilter() === t.val"
            [attr.aria-checked]="minCppFilter() === t.val"
            (click)="minCppFilter.set(t.val)">
            {{ t.label }}
          </button>
        </div>
      </div>

      <div class="count-line">{{ filtered().length }} spot{{ filtered().length !== 1 ? 's' : '' }}</div>

      <div class="spots-list">
        <div class="spot-card" *ngFor="let s of filtered()" [class]="'cat-' + s.category">
          <div class="spot-head">
            <button type="button" class="fav-btn" (click)="toggleFav(s)"
              [class.active]="isFav(spotKey(s))"
              [title]="isFav(spotKey(s)) ? 'Remove from saved' : 'Save this spot'"
              [attr.aria-label]="isFav(spotKey(s)) ? 'Remove saved sweet spot' : 'Save sweet spot'">
              {{ isFav(spotKey(s)) ? '★' : '☆' }}
            </button>
            <div class="spot-title-block">
              <div class="spot-route">
                <ng-container *ngFor="let part of routeParts(s.route); let last = last">
                  <span>{{ part }}</span>
                  <span class="arrow" *ngIf="!last"> → </span>
                </ng-container>
              </div>
              <div class="spot-detail">{{ s.detail.toUpperCase() }}</div>
            </div>
            <div class="spot-badge-stack">
              <div class="category-badge">{{ categoryLabel(s.category) }}</div>
              <div class="new-badge" *ngIf="s.isNew">✦ New</div>
            </div>
          </div>
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
          <!-- Wallet coverage badge — shows when user can afford this spot -->
          <div class="spot-covered-badge" *ngIf="canAfford(s)">
            ✓ You can book this
          </div>
          <!-- Bonus-assisted affordability badge -->
          <div class="spot-bonus-afford-badge" *ngIf="!canAfford(s) && getAffordableViaBonus(s) as bonusLabel">
            ⚡ Affordable with {{ bonusLabel }}
          </div>
          <!-- Active bonus badge — shows when any source card has an active transfer bonus -->
          <div class="spot-bonus-badge" *ngIf="getActiveBonusForSpot(s) as bonus">
            ⚡ {{ bonus.from }} → {{ bonus.to }} — {{ bonus.bonus }}
          </div>
          <p class="spot-note">{{ s.note }}</p>
          <div class="spot-action-row">
            <button type="button" class="spot-optimizer-btn" *ngIf="s.category === 'flight'"
              (click)="openInOptimizer(s)">
              Find in Optimizer →
            </button>
            <a *ngIf="getBookingUrl(s) as url"
              class="spot-book-link" [href]="'https://' + url"
              target="_blank" rel="noopener noreferrer">
              🔗 Book →
            </a>
            <button type="button" class="spot-share-btn"
              (click)="shareSpot(s)"
              [class.copied]="copiedSpotKey() === spotKey(s)">
              {{ copiedSpotKey() === spotKey(s) ? '✓ Copied' : '📋 Share' }}
            </button>
          </div>
          <div class="spot-chips">
            <span class="chip card-chip" *ngFor="let c of s.cards">{{ c }}</span>
            <span class="chip prog-chip" *ngFor="let p of s.programs">{{ p }}</span>
          </div>
        </div>
      </div>

      <div class="empty-filter" *ngIf="filtered().length === 0" aria-live="polite">
        <p>{{
          activeFilter() === 'saved' ? 'No saved spots yet — star a spot to save it.' :
          activeFilter() === 'covered' ? 'Add balances in Wallet to see which spots you can afford.' :
          activeFilter() === 'new' ? 'No new spots at the moment — check back soon.' :
          searchRaw() ? 'No spots match your search.' :
          'No spots match this filter.'
        }}</p>
        <button type="button" class="spot-clear-btn" *ngIf="searchRaw()" (click)="searchRaw.set('')">Clear search</button>
        <button type="button" class="spot-clear-btn" *ngIf="!searchRaw() && hasActiveFilters()" (click)="clearFilters()">Clear filters</button>
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
      padding: 11px 0; min-width: 0;
    }
    .spot-search-input::placeholder { color: var(--text3); }
    .spot-search-input::-webkit-search-cancel-button { display: none; }
    .spot-search-clear {
      background: none; border: none; cursor: pointer; padding: 4px;
      min-width: 44px; min-height: 44px; border-radius: 50%;
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
      scrollbar-width: none; overscroll-behavior-inline: contain;
      scroll-snap-type: x proximity; -webkit-overflow-scrolling: touch;
    }
    .bonuses-strip::-webkit-scrollbar { display: none; }
    .bonus-card {
      background: var(--white); border: 1px solid rgba(217,119,6,0.25);
      border-radius: 12px; padding: 12px 14px; min-width: 0;
      flex: 0 0 min(260px, calc(100vw - 42px)); box-sizing: border-box;
      border-top: 2px solid var(--tally-amber, #d97706);
      scroll-snap-align: start;
    }
    .bonus-header {
      display: flex; align-items: center; gap: 6px; margin-bottom: 3px; min-width: 0;
    }
    .bonus-from {
      font-family: 'Geist Mono', monospace; font-size: 10px; color: var(--text3);
      min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .bonus-arrow { color: var(--tally-amber, #d97706); font-size: 11px; }
    .bonus-to-icon { font-size: 14px; }
    .bonus-pct {
      font-family: 'Geist Mono', monospace; font-size: 12px; font-weight: 700;
      color: var(--tally-amber, #d97706); margin-left: auto; flex-shrink: 0;
    }
    .bonus-to {
      font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 2px;
      overflow-wrap: anywhere;
    }
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
      min-height: 44px; max-width: 100%;
    }
    .filter-btn.active {
      background: var(--tally-green); border-color: var(--tally-green);
      color: var(--on-accent);
    }

    .sort-row {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;
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
      min-height: 44px;
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
      display: flex; flex-direction: column;
    }
    .spot-card::before {
      content: ''; position: absolute;
      top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, var(--tally-green), transparent);
    }
    .spot-card.cat-hotel::before { background: linear-gradient(90deg, transparent, var(--tally-amber, #b45309), transparent); }
    .spot-card.cat-promo::before { background: linear-gradient(90deg, transparent, var(--tally-green-mid), transparent); }

    .spot-head {
      display: grid; grid-template-columns: 44px minmax(0, 1fr) auto;
      gap: 8px; align-items: start; margin-bottom: 14px;
    }
    .spot-title-block { min-width: 0; }
    .spot-badge-stack {
      display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
      max-width: 112px;
    }

    .category-badge {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.12em; text-transform: uppercase;
      padding: 3px 7px; border-radius: 4px;
      background: var(--surface); border: 1px solid var(--border);
      color: var(--text3); overflow-wrap: anywhere;
    }

    .spot-route {
      font-family: 'Instrument Serif', serif;
      font-size: 20px; font-weight: 400; color: var(--text);
      overflow-wrap: anywhere;
    }
    .spot-route .arrow { color: var(--tally-green); font-style: italic; }

    .spot-detail {
      font-family: 'Geist Mono', monospace;
      font-size: 9px; letter-spacing: 0.1em; color: var(--text3); margin-top: 4px;
      overflow-wrap: anywhere;
    }
    .spot-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 8px; margin-bottom: 12px; }
    .stat {
      background: var(--surface); border-radius: 10px; padding: 10px;
      text-align: center; display: flex; flex-direction: column; gap: 2px;
      min-width: 0;
    }
    .stat-val { font-family: 'Geist Mono', monospace; font-size: 13px; color: var(--tally-green); overflow-wrap: anywhere; }
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
      overflow-wrap: anywhere;
    }
    .card-chip { background: var(--surface); border: 1px solid var(--border); color: var(--text2); }
    .prog-chip { background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2); color: var(--tally-green); }

    .spot-covered-badge {
      display: inline-block; margin-bottom: 6px; margin-right: 6px;
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.25);
      border-radius: 6px; padding: 3px 10px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; color: var(--tally-green); font-weight: 600;
    }
    .spot-bonus-badge {
      display: inline-block; margin-bottom: 8px;
      background: rgba(217,119,6,0.1); border: 1px solid rgba(217,119,6,0.3);
      border-radius: 6px; padding: 3px 10px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; color: var(--tally-amber, #d97706);
      max-width: 100%; overflow-wrap: anywhere;
    }
    .cov-count {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--tally-green); color: var(--on-accent);
      font-family: 'Geist Mono', monospace; font-size: 8px;
      width: 14px; height: 14px; border-radius: 50%; margin-left: 4px;
    }

    .spot-action-row {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;
    }
    .spot-optimizer-btn {
      display: inline-flex; align-items: center; justify-content: center; text-align: center;
      background: none; border: 1px solid var(--tally-green);
      border-radius: 8px; color: var(--tally-green);
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.06em; padding: 5px 12px; cursor: pointer;
      transition: all 0.15s; min-height: 44px; flex: 1 1 132px;
    }
    .spot-optimizer-btn:hover { background: var(--tally-green); color: var(--on-accent); }
    .spot-book-link {
      display: inline-flex; align-items: center; justify-content: center; text-align: center;
      background: none; border: 1px solid rgba(26,122,74,0.3); border-radius: 8px;
      color: var(--tally-green); font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.06em; padding: 5px 10px;
      text-decoration: none; transition: all 0.15s; min-height: 44px; flex: 1 1 96px;
    }
    .spot-book-link:hover { background: var(--tally-green-light); }
    .spot-share-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.06em; padding: 5px 10px; cursor: pointer;
      transition: all 0.15s; min-height: 44px; flex: 1 1 96px;
    }
    .spot-share-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .spot-share-btn.copied { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }

    /* Bonus-assisted affordability badge */
    .spot-bonus-afford-badge {
      display: inline-block; margin: 4px 0;
      background: rgba(217,119,6,0.08); border: 1px solid rgba(217,119,6,0.25);
      border-radius: 20px; padding: 2px 10px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; color: var(--tally-amber, #b45309);
      max-width: 100%; overflow-wrap: anywhere;
    }

    /* CPP min filter */
    .cpp-filter-row {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;
    }
    .cpp-filter-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.12em; text-transform: uppercase; color: var(--text3);
      flex-shrink: 0;
    }
    .cpp-tiers { display: flex; gap: 4px; flex-wrap: wrap; }
    .cpp-tier-btn {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 4px 10px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; color: var(--text3); cursor: pointer;
      transition: all 0.15s; white-space: nowrap; min-height: 44px;
    }
    .cpp-tier-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .cpp-tier-btn.active { background: var(--tally-green); border-color: var(--tally-green); color: var(--on-accent); }

    .empty-filter { text-align: center; padding: 32px 16px; color: var(--text3); font-size: 14px; }
    .spot-clear-btn {
      background: none; border: none; color: var(--tally-green); font-size: 13px;
      cursor: pointer; text-decoration: underline; padding: 8px; margin-top: 4px;
      min-height: 44px;
    }

    /* "New" badge on recently added spots */
    .new-badge {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.12em; text-transform: uppercase;
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2);
      color: var(--tally-green); border-radius: 4px; padding: 2px 6px;
      overflow-wrap: anywhere;
    }

    /* Favorites button on each card */
    .fav-btn {
      background: none; border: none; cursor: pointer;
      font-size: 16px; color: var(--border2); line-height: 1;
      padding: 4px; transition: color 0.15s, transform 0.15s;
      min-width: 44px; min-height: 44px; border-radius: 50%;
      -webkit-tap-highlight-color: transparent;
    }
    .fav-btn:hover { color: var(--tally-amber, #d97706); transform: scale(1.15); }
    .fav-btn.active { color: var(--tally-amber, #d97706); }

    /* Saved filter count badge */
    .fav-count {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--tally-amber, #d97706); color: var(--on-accent);
      font-family: 'Geist Mono', monospace; font-size: 8px;
      width: 14px; height: 14px; border-radius: 50%; margin-left: 4px;
    }
    @media (min-width: 760px) {
      .bonuses-strip {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        overflow-x: visible;
      }
      .bonus-card {
        flex-basis: auto;
        width: auto;
      }
      .spots-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        align-items: start;
      }
      .spot-card {
        min-height: 100%;
      }
      .spot-note { flex: 1; }
      .spot-action-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
      }
      .spot-optimizer-btn,
      .spot-book-link,
      .spot-share-btn {
        width: 100%;
      }
    }
    @media (max-width: 520px) {
      .spot-head {
        grid-template-columns: 44px minmax(0, 1fr);
      }
      .spot-badge-stack {
        grid-column: 2;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: center;
        max-width: none;
      }
      .filter-row,
      .sort-row,
      .cpp-filter-row,
      .cpp-tiers {
        flex-wrap: nowrap;
        overflow-x: auto;
        padding-bottom: 4px;
        scrollbar-width: none;
      }
      .filter-row::-webkit-scrollbar,
      .sort-row::-webkit-scrollbar,
      .cpp-filter-row::-webkit-scrollbar,
      .cpp-tiers::-webkit-scrollbar { display: none; }
      .filter-btn,
      .sort-btn,
      .cpp-tier-btn { flex: 0 0 auto; white-space: nowrap; }
    }
    @media (max-width: 360px) {
      .spot-card {
        padding: 16px 14px;
      }
      .spot-route {
        font-size: 18px;
      }
      .category-badge,
      .new-badge {
        font-size: 7px;
      }
      .stat {
        padding: 9px 6px;
      }
    }
  `]
})
export class SweetspotsComponent {
  data = inject(DataService);
  wallet = inject(WalletService);
  private nav = inject(NavigationService);
  private analytics = inject(AnalyticsService);
  private toast = inject(ToastService);
  private readonly initialUiState = this.loadUiState();

  searchRaw = signal(this.loadSearchState());
  activeFilter = signal<Filter>(this.loadInitialFilter());
  activeSort = signal<SortMode>(this.initialUiState.activeSort ?? 'default');
  minCppFilter = signal<number>(this.initialUiState.minCppFilter ?? 0);
  private _favs = signal<Set<string>>(this.loadFavs());
  copiedSpotKey = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.saveUiState({
        activeFilter: this.activeFilter(),
        activeSort: this.activeSort(),
        minCppFilter: this.minCppFilter(),
      });
      this.saveSearchState(this.searchRaw());
    });
  }

  readonly cppTiers: CppTier[] = CPP_TIERS;

  readonly sortModes: { id: SortMode; label: string }[] = [
    { id: 'default', label: 'Default' },
    { id: 'cpp',     label: '↑ CPP' },
    { id: 'pts',     label: '↑ Points' },
  ];

  readonly favCount = computed(() => this._favs().size);

  readonly filters: { id: Filter; label: string }[] = [
    { id: 'all',     label: 'All' },
    { id: 'flight',  label: '✈ Flights' },
    { id: 'hotel',   label: '🏨 Hotels' },
    { id: 'promo',   label: '⚡ Promos' },
    { id: 'new',     label: '✦ New' },
    { id: 'covered', label: '✓ Can Afford' },
    { id: 'saved',   label: '★ Saved' },
  ];

  readonly filtered = computed<SweetSpot[]>(() => {
    const f = this.activeFilter();
    const favs = this._favs();
    const sort = this.activeSort();
    const q = this.searchRaw().toLowerCase().trim();
    const minCpp = this.minCppFilter();

    let spots: SweetSpot[];
    if (f === 'saved')   spots = this.data.sweetSpots.filter(s => favs.has(this.spotKey(s)));
    else if (f === 'covered') spots = this.data.sweetSpots.filter(s => this.canAfford(s));
    else if (f === 'new') spots = this.data.sweetSpots.filter(s => s.isNew);
    else if (f === 'all') spots = [...this.data.sweetSpots];
    else spots = this.data.sweetSpots.filter(s => s.category === f);

    // CPP minimum filter — treat '∞' or unparseable values as infinite (always pass)
    if (minCpp > 0) {
      spots = spots.filter(s => {
        const parsed = parseFloat(s.cpp);
        return isNaN(parsed) || parsed >= minCpp;
      });
    }

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
        const pA = this.parsePts(a.ptsNeeded);
        const pB = this.parsePts(b.ptsNeeded);
        return pA - pB;
      });
    } else if (f === 'all' && this.wallet.hasAnyPoints()) {
      // Default sort on 'all': float affordable spots to the top
      spots = [...spots].sort((a, b) => {
        const covA = this.canAfford(a) ? 1 : 0;
        const covB = this.canAfford(b) ? 1 : 0;
        return covB - covA; // covered first
      });
    }
    return spots;
  });

  spotKey(s: SweetSpot): string {
    return [s.category, s.route, s.detail, s.ptsNeeded, s.programs.join('+')].join('|');
  }

  isFav(key: string): boolean {
    return this._favs().has(key);
  }

  toggleFav(spot: SweetSpot): void {
    const key = this.spotKey(spot);
    let saved = false;
    this._favs.update(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        saved = false;
      } else {
        next.add(key);
        saved = true;
      }
      this.saveFavs(next);
      return next;
    });
    this.analytics.track('sweet_spot_favorited', {
      spot_key: key,
      cpp_tier: this.cppTier(spot.cpp),
      saved,
    });
  }

  private loadInitialFilter(): Filter {
    try {
      const stored = localStorage.getItem(FILTER_KEY) as Filter | null;
      if (stored) {
        localStorage.removeItem(FILTER_KEY);
        return this.isFilter(stored) ? stored : 'all';
      }
      return this.initialUiState.activeFilter ?? 'all';
    } catch {
      return this.initialUiState.activeFilter ?? 'all';
    }
  }

  private isFilter(value: string): value is Filter {
    return ['all', 'flight', 'hotel', 'promo', 'new', 'saved', 'covered'].includes(value);
  }

  hasActiveFilters(): boolean {
    return this.activeFilter() !== 'all' || this.activeSort() !== 'default' || this.minCppFilter() !== 0;
  }

  clearFilters(): void {
    this.activeFilter.set('all');
    this.activeSort.set('default');
    this.minCppFilter.set(0);
  }

  private isSortMode(value: unknown): value is SortMode {
    return value === 'default' || value === 'cpp' || value === 'pts';
  }

  private isCppTier(value: unknown): value is number {
    return typeof value === 'number' && CPP_TIERS.some(t => t.val === value);
  }

  private loadUiState(): SweetSpotsUiState {
    try {
      const raw = localStorage.getItem(UI_STATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as SweetSpotsUiState;
      const activeFilter = parsed.activeFilter;
      return {
        activeFilter: typeof activeFilter === 'string' && this.isFilter(activeFilter) ? activeFilter : undefined,
        activeSort: this.isSortMode(parsed.activeSort) ? parsed.activeSort : undefined,
        minCppFilter: this.isCppTier(parsed.minCppFilter) ? parsed.minCppFilter : undefined,
      };
    } catch {
      return {};
    }
  }

  private saveUiState(state: SweetSpotsUiState): void {
    try {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
    } catch {}
  }

  private loadSearchState(): string {
    try {
      return sessionStorage.getItem(SEARCH_STATE_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private saveSearchState(value: string): void {
    try {
      if (value) sessionStorage.setItem(SEARCH_STATE_KEY, value);
      else sessionStorage.removeItem(SEARCH_STATE_KEY);
    } catch {}
  }

  private cppTier(cpp: string): string {
    const parsed = parseFloat(cpp);
    if (Number.isNaN(parsed)) return 'infinite_or_unknown';
    if (parsed >= 2.5) return '2.5_plus';
    if (parsed >= 2) return '2_plus';
    if (parsed >= 1.5) return '1.5_plus';
    if (parsed >= 1) return '1_plus';
    return 'under_1';
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

  routeParts(route: string): string[] {
    return route.split('→').map(part => part.trim()).filter(Boolean);
  }

  categoryLabel(cat: SweetSpot['category']): string {
    switch (cat) {
      case 'flight': return '✈ Flight';
      case 'hotel':  return '🏨 Hotel';
      case 'promo':  return '⚡ Promo';
    }
  }

  /** Returns the first active transfer bonus that applies to any of the spot's source cards */
  getActiveBonusForSpot(spot: SweetSpot): TransferBonus | null {
    const today = new Date().toISOString().slice(0, 10);
    return this.data.transferBonuses.find(b =>
      b.expires >= today && spot.cards.some(c => c === b.from)
    ) ?? null;
  }

  /** Returns the award booking URL for the first matching program on a spot */
  getBookingUrl(spot: SweetSpot): string | null {
    for (const prog of spot.programs) {
      const url = BOOKING_URLS[prog];
      if (url) return url;
    }
    return null;
  }

  /** Parse a sweet spot and navigate to the Optimizer tab pre-filled */
  openInOptimizer(s: SweetSpot): void {
    // Try to extract airport codes from route like "JFK → SIN" or "US → Europe"
    const parts = s.route.split('→').map(p => p.trim());
    let fromCity = parts[0]?.match(/\b([A-Z]{3})\b/)?.[1] ?? '';
    const toCity = parts[1]?.match(/\b([A-Z]{3})\b/)?.[1] ?? '';

    // Fall back to saved home airport when route doesn't include a departure code
    if (!fromCity) {
      try { fromCity = localStorage.getItem('tally_home_airport_v1') ?? ''; } catch {}
    }

    // Infer cabin from detail field (e.g. "BUSINESS CLASS" / "FIRST CLASS")
    const detail = s.detail.toUpperCase();
    let cabin: 'economy' | 'premium' | 'business' | 'first' = 'business';
    if (detail.includes('FIRST'))   cabin = 'first';
    else if (detail.includes('ECONOMY')) cabin = 'economy';
    else if (detail.includes('PREMIUM')) cabin = 'premium';

    this.nav.navigateTo({ tab: 'optimizer', optimizerPrefill: { fromCity, toCity, cabin } });
  }

  /** Parse values like "88,000", "8,000-15,000/night", or "4x 30,000". */
  private parsePts(ptsNeeded: string): number {
    const multiplier = ptsNeeded.match(/(\d+)\s*[x×]\s*(\d[\d,]*)/i);
    if (multiplier) {
      return this.parseNumber(multiplier[1]) * this.parseNumber(multiplier[2]);
    }

    const firstNumber = ptsNeeded.match(/\d[\d,]*/)?.[0];
    return firstNumber ? this.parseNumber(firstNumber) : 0;
  }

  private parseNumber(value: string): number {
    return parseInt(value.replace(/,/g, ''), 10) || 0;
  }

  /**
   * True when the user's wallet balance in any of the spot's source card programs
   * meets or exceeds the spot's points requirement.
   * Spots with "0" pts (like cert promos) are always considered covered.
   */
  canAfford(spot: SweetSpot): boolean {
    if (!this.wallet.hasAnyPoints()) return false;
    const needed = this.parsePts(spot.ptsNeeded);
    if (needed === 0) return true; // free cert / promo
    const today = new Date().toISOString().slice(0, 10);
    // Map spot.cards (short names like "Amex MR") to card ids
    for (const card of this.data.cards) {
      const shortMatch = spot.cards.some(c =>
        c.toLowerCase().includes(card.short?.toLowerCase() ?? '') ||
        card.name.toLowerCase().includes(c.toLowerCase())
      );
      if (!shortMatch) continue;
      const balance = this.wallet.getBalance(card.id);
      if (balance <= 0) continue;
      // Direct affordability check
      if (balance >= needed) return true;
      // Check if an active transfer bonus to a matching program makes it affordable
      const activeBonus = this.data.transferBonuses.find(b =>
        b.fromId === card.id && b.expires >= today &&
        spot.programs.some(p =>
          p.toLowerCase().includes(b.to.toLowerCase().split('/')[0].trim()) ||
          b.to.toLowerCase().includes(p.toLowerCase().split('/')[0].trim())
        )
      );
      if (activeBonus) {
        const pct = parseInt(activeBonus.bonus) / 100; // '30% bonus' → 0.3
        if (Math.floor(balance * (1 + pct)) >= needed) return true;
      }
    }
    return false;
  }

  /** Returns the active bonus that makes a spot affordable (when direct balance isn't enough) */
  getAffordableViaBonus(spot: SweetSpot): string | null {
    if (!this.wallet.hasAnyPoints()) return null;
    const needed = this.parsePts(spot.ptsNeeded);
    if (needed === 0) return null;
    const today = new Date().toISOString().slice(0, 10);
    for (const card of this.data.cards) {
      const shortMatch = spot.cards.some(c =>
        c.toLowerCase().includes(card.short?.toLowerCase() ?? '') ||
        card.name.toLowerCase().includes(c.toLowerCase())
      );
      if (!shortMatch) continue;
      const balance = this.wallet.getBalance(card.id);
      if (balance <= 0 || balance >= needed) continue; // skip if can afford directly
      const activeBonus = this.data.transferBonuses.find(b =>
        b.fromId === card.id && b.expires >= today &&
        spot.programs.some(p =>
          p.toLowerCase().includes(b.to.toLowerCase().split('/')[0].trim()) ||
          b.to.toLowerCase().includes(p.toLowerCase().split('/')[0].trim())
        )
      );
      if (activeBonus) {
        const pct = parseInt(activeBonus.bonus) / 100;
        if (Math.floor(balance * (1 + pct)) >= needed) {
          return `${activeBonus.bonus} on ${card.short}`;
        }
      }
    }
    return null;
  }

  /** Count of spots the user can currently afford — drives the filter badge */
  readonly coveredCount = computed(() => {
    if (!this.wallet.hasAnyPoints()) return 0;
    return this.data.sweetSpots.filter(s => this.canAfford(s)).length;
  });

  shareSpot(s: SweetSpot): void {
    const lines = [
      `✈ Sweet Spot: ${s.route}`,
      `${s.detail}`,
      ``,
      `Points: ${s.ptsNeeded} | Cash value: ${s.estCash} | CPP: ${s.cpp}`,
      `Programs: ${s.programs.join(', ')}`,
      `Cards: ${s.cards.join(', ')}`,
      ``,
      `Note: ${s.note}`,
      ``,
      `Found with Tally Points Advisor`,
    ];
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) {
      this.toast.error('Clipboard unavailable');
      return;
    }

    clipboard.writeText(lines.join('\n')).then(() => {
      const key = this.spotKey(s);
      this.copiedSpotKey.set(key);
      setTimeout(() => this.copiedSpotKey.set(null), 2000);
    }).catch(() => this.toast.error('Could not copy sweet spot'));
  }

  formatExpiry(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataService } from '../../core/services/data.service';
import { WalletService } from '../../core/services/wallet.service';
import { CreditCard } from '../../core/models';

type CatFilter = 'all' | 'transferable' | 'airline' | 'hotel';
type CardSortMode = 'default' | 'cpp' | 'balance';
type SpendCat = 'travel' | 'dining' | 'groceries' | 'gas' | 'online' | 'general';

/** Typical transfer processing times per source program → partner name */
const TRANSFER_TIMES: Partial<Record<string, Record<string, string>>> = {
  amex_mr: {
    'Air Canada Aeroplan':        'Instant',
    'British Airways Avios':       'Instant',
    'Air France/KLM Flying Blue':  'Instant',
    'Singapore KrisFlyer':         '1–3 days',
    'ANA Mileage Club':            '3–5 business days',
    'Virgin Atlantic Flying Club': 'Instant',
    'Delta SkyMiles':              'Instant',
    'Hilton Honors':               'Instant',
    'Marriott Bonvoy':             '1–5 days',
  },
  chase_ur: {
    'Air Canada Aeroplan':         'Instant',
    'British Airways Avios':        'Instant',
    'United MileagePlus':           'Instant',
    'Air France/KLM Flying Blue':   'Instant',
    'Virgin Atlantic Flying Club':  'Instant',
    'Singapore KrisFlyer':          'Instant',
    'Southwest Rapid Rewards':      'Instant',
    'World of Hyatt':               'Instant',
    'IHG One Rewards':              'Instant',
    'Marriott Bonvoy':              '1–5 days',
  },
  citi_ty: {
    'Air France/KLM Flying Blue':  '2–4 days',
    'Virgin Atlantic Flying Club':  '2–4 days',
    'Singapore KrisFlyer':          '2–4 days',
    'Turkish Miles&Smiles':         '2–4 days',
    'Air Canada Aeroplan':          '2–4 days',
    'Avianca LifeMiles':            '2–4 days',
    'JetBlue TrueBlue':            'Instant',
    'Wyndham Rewards':             '2–4 days',
  },
  cap1_miles: {
    'Air Canada Aeroplan':          'Instant',
    'British Airways Avios':         'Instant',
    'Air France/KLM Flying Blue':   'Instant',
    'Turkish Miles&Smiles':          '2–4 days',
    'Singapore KrisFlyer':           'Instant',
    'Avianca LifeMiles':             '2–4 days',
    'Wyndham Rewards':              'Instant',
  },
  bilt: {
    'Air Canada Aeroplan':          'Instant',
    'American AAdvantage':           'Instant',
    'United MileagePlus':            'Instant',
    'Alaska MileagePlan':            'Instant',
    'Emirates Skywards':             '1–2 days',
    'World of Hyatt':                'Instant',
    'IHG One Rewards':               'Instant',
    'Marriott Bonvoy':               '1–5 days',
  },
  delta_skymiles: {
    'Air France/KLM Flying Blue': '1–3 days',
    'Korean Air SkyPass':         '1–3 days',
    'Virgin Atlantic Flying Club':'1–3 days',
    'Aeromexico Club Premier':    '1–3 days',
  },
  united_mp: {
    'Air Canada':         '1–3 days',
    'Lufthansa':           '1–3 days',
    'ANA':                 '1–3 days',
    'Singapore Airlines':  '1–3 days',
  },
  aa_aadvantage: {
    'British Airways':    '1–3 days',
    'Iberia':             '1–3 days',
    'Japan Airlines':     '1–3 days',
    'Cathay Pacific':     '1–3 days',
    'Finnair Plus':       '1–3 days',
  },
};

const EARN_RATES: Partial<Record<string, Partial<Record<SpendCat, number>>>> = {
  amex_mr:        { travel: 5, dining: 4, groceries: 4, gas: 1, online: 1, general: 2 },
  chase_ur:       { travel: 3, dining: 3, groceries: 3, gas: 1, online: 1, general: 1 },
  citi_ty:        { travel: 3, dining: 3, groceries: 3, gas: 3, online: 1, general: 1 },
  cap1_miles:     { travel: 2, dining: 2, groceries: 2, gas: 2, online: 2, general: 2 },
  bilt:           { travel: 2, dining: 3, groceries: 1, gas: 1, online: 1, general: 1 },
  delta_skymiles: { travel: 2, dining: 2, groceries: 2, gas: 1, online: 1, general: 1 },
  united_mp:      { travel: 2, dining: 2, groceries: 1, gas: 2, online: 1, general: 1 },
  aa_aadvantage:  { travel: 2, dining: 1, groceries: 1, gas: 1, online: 1, general: 1 },
  southwest_rr:   { travel: 2, dining: 2, groceries: 1, gas: 1, online: 1, general: 1 },
  alaska_mp:      { travel: 3, dining: 2, groceries: 1, gas: 1, online: 1, general: 1 },
  hyatt:          { travel: 2, dining: 2, groceries: 1, gas: 1, online: 1, general: 1 },
  marriott_bonvoy:{ travel: 2, dining: 2, groceries: 1, gas: 2, online: 1, general: 2 },
  hilton_honors:  { travel: 1, dining: 5, groceries: 3, gas: 5, online: 1, general: 3 },
  ihg_rewards:    { travel: 2, dining: 1, groceries: 1, gas: 1, online: 1, general: 1 },
};

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

      <!-- Category tabs + great toggle + mine filter -->
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
        <button class="filter-btn mine-toggle" [class.active]="showHeldOnly()"
          *ngIf="wallet.hasAnyPoints()"
          (click)="showHeldOnly.set(!showHeldOnly())">
          {{ showHeldOnly() ? '★ Mine' : '☆ Mine' }}
        </button>
      </div>

      <!-- Sort row -->
      <div class="sort-row">
        <span class="sort-label">Sort:</span>
        <button *ngFor="let s of cardSortModes"
          class="sort-btn" [class.active]="cardSort() === s.id"
          (click)="cardSort.set(s.id)">
          {{ s.label }}
        </button>
      </div>

      <div class="count-line">
        {{ filteredCards().length }} program{{ filteredCards().length !== 1 ? 's' : '' }}
      </div>

      <!-- Best card for spend category -->
      <div class="spend-rec-section">
        <button class="spend-rec-toggle" (click)="showSpendRec.set(!showSpendRec())">
          <span>💳 Best card for your spend</span>
          <span class="spend-rec-chevron">{{ showSpendRec() ? '▲' : '▼' }}</span>
        </button>
        <div class="spend-rec-body" *ngIf="showSpendRec()">
          <div class="spend-cat-row">
            <button *ngFor="let c of spendCats" class="spend-cat-btn"
              [class.active]="selectedSpendCat() === c.id"
              (click)="selectedSpendCat.set(c.id)">
              {{ c.icon }} {{ c.label }}
            </button>
          </div>
          <div class="spend-results">
            <div class="spend-result-row" *ngFor="let r of bestForCategory(); let i = index"
              [class.spend-top]="i === 0">
              <div class="spend-badge" [style.background]="r.card.color">{{ r.card.icon }}</div>
              <div class="spend-info">
                <div class="spend-name">{{ r.card.name }}</div>
                <div class="spend-cards">{{ r.card.cards[0] }}<span *ngIf="r.card.cards.length > 1"> & more</span></div>
              </div>
              <div class="spend-rate" [class.spend-rate-top]="i === 0">
                {{ r.rate }}x<small>pts/$</small>
              </div>
            </div>
            <p class="spend-note">Rates shown are the highest available on any card in each program. Exact rates vary by card.</p>
          </div>
        </div>
      </div>

      <!-- Reachable Partners panel — only when user has wallet points -->
      <div class="reach-section" *ngIf="wallet.hasAnyPoints()">
        <button class="reach-toggle" (click)="showReachable.set(!showReachable())">
          <span>🗺 My reachable partners</span>
          <span class="reach-badge">{{ reachablePartners().length }}</span>
          <span class="reach-chevron">{{ showReachable() ? '▲' : '▼' }}</span>
        </button>
        <div class="reach-body" *ngIf="showReachable()">
          <p class="reach-note">All airline & hotel partners you can transfer to with your current balances.</p>
          <div class="reach-list">
            <div class="reach-row" *ngFor="let p of reachablePartners(); let i = index"
              [class.reach-top]="i === 0">
              <span class="reach-icon">{{ p.icon }}</span>
              <div class="reach-info">
                <div class="reach-name">{{ p.name }}</div>
                <div class="reach-via">via {{ p.via }}</div>
              </div>
              <div class="reach-cpp" [class.great]="p.cpp >= 2.0">
                {{ p.cpp }}¢<small>/pt</small>
              </div>
            </div>
          </div>
        </div>
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
              <!-- Active transfer bonus pill -->
              <div class="cc-bonus-pill" *ngIf="hasActiveBonus(card.id)">
                ⚡ Active bonus
              </div>
            </div>
            <div class="cc-right">
              <div class="cc-partner-count" *ngIf="card.category === 'transferable'">
                <span class="cc-pc-great">{{ greatPartnerCount(card) }}★</span>
                <span class="cc-pc-total"> / {{ card.partners.length }}</span>
              </div>
              <div class="cc-best">
                <div class="cc-best-val">{{ getBestCpp(card) }}¢</div>
                <div class="cc-best-label">best cpp</div>
              </div>
              <span class="cc-chevron">{{ isExpanded(card.id) ? '▲' : '▼' }}</span>
            </div>
          </button>
          <div class="partners" *ngIf="isExpanded(card.id)">
            <!-- Program-level strategic tip -->
            <div class="pro-tip" *ngIf="getProTip(card.id) as tip">
              <span class="pro-tip-icon">💡</span>
              <span class="pro-tip-text">{{ tip }}</span>
            </div>
            <!-- Earn rate mini-row -->
            <div class="earn-rate-row" *ngIf="getEarnRates(card.id).length > 0">
              <span class="earn-rate-chip" *ngFor="let r of getEarnRates(card.id)"
                [class.earn-best]="r.best">
                {{ r.icon }} {{ r.rate }}×
              </span>
            </div>
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
                <div class="td-timing" [class.td-timing-instant]="isInstantTransfer(card.id, p.name)">
                  <span class="td-timing-icon">⏱</span>
                  Transfer posts: <strong>{{ getTransferTime(card.id, p.name) }}</strong>
                </div>
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

      <!-- Transfer Route Finder -->
      <div class="calc-section" style="margin-top:10px">
        <button class="calc-toggle" (click)="showTransferFinder.set(!showTransferFinder())">
          <span>🔀 Transfer Route Finder</span>
          <span class="calc-chevron">{{ showTransferFinder() ? '▲' : '▼' }}</span>
        </button>
        <div class="calc-body" *ngIf="showTransferFinder()">
          <div class="tf-inputs">
            <div class="calc-input-wrap">
              <label class="calc-label">Target program</label>
              <select class="calc-input" [(ngModel)]="tfTargetPartner">
                <option value="">-- pick a partner --</option>
                <option *ngFor="let p of allPartnerNames" [value]="p">{{ p }}</option>
              </select>
            </div>
            <div class="calc-input-wrap">
              <label class="calc-label">Miles / pts needed</label>
              <input class="calc-input" type="number" inputmode="numeric"
                [(ngModel)]="tfTargetMiles" placeholder="60000" min="0" step="5000">
            </div>
          </div>
          <div class="tf-results" *ngIf="tfTargetPartner && tfRoutes().length > 0">
            <div class="tf-row" *ngFor="let r of tfRoutes()"
              [class.tf-covered]="r.covered">
              <div class="tf-source-badge" [style.background]="r.card.color">{{ r.card.icon }}</div>
              <div class="tf-source-info">
                <div class="tf-source-name">{{ r.card.short }}</div>
                <div class="tf-source-ratio">{{ r.ratio }} ratio · need {{ r.srcNeeded | number }} pts</div>
              </div>
              <div class="tf-coverage" [class.tf-cov-ok]="r.covered">
                <span *ngIf="wallet.getBalance(r.card.id) > 0">{{ wallet.getBalance(r.card.id) | number }} / {{ r.srcNeeded | number }}</span>
                <span *ngIf="wallet.getBalance(r.card.id) === 0">No balance</span>
                <span class="tf-check" *ngIf="r.covered">✓</span>
              </div>
            </div>
          </div>
          <div class="tf-empty" *ngIf="tfTargetPartner && tfRoutes().length === 0">
            <p>No transfer paths found for this partner. It may not be a transfer partner of any tracked program.</p>
          </div>
          <div class="tf-hint" *ngIf="!tfTargetPartner">
            Select a target partner to see all transfer paths and whether your wallet can cover the needed miles.
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

    /* Sort row */
    .sort-row {
      display: flex; align-items: center; gap: 6px; margin-bottom: 10px; flex-wrap: wrap;
    }
    .sort-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--text3);
    }
    .sort-btn {
      background: none; border: 1px solid var(--border); border-radius: 16px;
      padding: 3px 10px; font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; color: var(--text3); cursor: pointer; transition: all 0.15s;
    }
    .sort-btn.active { border-color: var(--tally-green); color: var(--tally-green); }

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
    .mine-toggle.active {
      background: #6366f1; border-color: #6366f1;
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
    .cc-bonus-pill {
      display: inline-block; margin-top: 3px;
      background: rgba(217,119,6,0.1); border: 1px solid rgba(217,119,6,0.3);
      border-radius: 20px; padding: 1px 7px;
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.06em; color: var(--tally-amber, #b45309);
    }

    .cc-partner-count {
      text-align: right; font-family: 'Geist Mono', monospace; font-size: 10px;
      margin-bottom: 3px; letter-spacing: 0.04em;
    }
    .cc-pc-great { color: var(--tally-green); font-weight: 600; }
    .cc-pc-total { color: var(--text3); }
    .cc-best { text-align: right; }
    .cc-best-val { font-family: 'Geist Mono', monospace; font-size: 16px; color: var(--tally-green); }
    .cc-best-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); letter-spacing: 0.1em; text-transform: uppercase;
    }

    .partners { padding: 12px 18px; display: flex; flex-direction: column; gap: 4px; }

    /* Earn rate chips */
    .earn-rate-row {
      display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 8px;
    }
    .earn-rate-chip {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 3px 9px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; color: var(--text3);
    }
    .earn-rate-chip.earn-best {
      background: var(--tally-green-light); border-color: rgba(26,122,74,0.3);
      color: var(--tally-green); font-weight: 600;
    }

    /* Strategic program tip */
    .pro-tip {
      display: flex; align-items: flex-start; gap: 7px;
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.15);
      border-radius: 9px; padding: 9px 12px; margin-bottom: 6px;
    }
    .pro-tip-icon { font-size: 13px; flex-shrink: 0; margin-top: 1px; }
    .pro-tip-text { font-size: 11px; color: var(--tally-green-mid, #2d8a5a); line-height: 1.5; font-style: italic; }
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
    .td-timing {
      display: flex; align-items: center; gap: 5px; margin-top: 6px;
      padding-top: 6px; border-top: 1px solid var(--border);
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); letter-spacing: 0.04em;
    }
    .td-timing strong { color: var(--text2); }
    .td-timing-icon { flex-shrink: 0; }
    .td-timing.td-timing-instant { color: var(--tally-green); }
    .td-timing.td-timing-instant strong { color: var(--tally-green); }

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

    /* Best card for spend */
    .spend-rec-section { margin-bottom: 16px; }
    .spend-rec-toggle {
      width: 100%; background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 12px 16px;
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 500;
      color: var(--text2); cursor: pointer; display: flex;
      align-items: center; justify-content: space-between;
      transition: border-color 0.15s;
    }
    .spend-rec-toggle:hover { border-color: var(--tally-green); }
    .spend-rec-chevron { font-size: 10px; color: var(--text3); }
    .spend-rec-body {
      background: var(--white); border: 1px solid var(--border);
      border-top: none; border-radius: 0 0 12px 12px; padding: 14px 16px;
    }
    .spend-cat-row { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 14px; }
    .spend-cat-btn {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 5px 11px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.05em; color: var(--text3); cursor: pointer;
      transition: all 0.15s;
    }
    .spend-cat-btn.active {
      background: var(--tally-green); border-color: var(--tally-green); color: white;
    }
    .spend-results { display: flex; flex-direction: column; gap: 8px; }
    .spend-result-row {
      display: flex; align-items: center; gap: 10px;
      background: var(--surface); border-radius: 10px; padding: 10px 12px;
      border: 1px solid var(--border);
    }
    .spend-result-row.spend-top {
      background: var(--tally-green-light); border-color: rgba(26,122,74,0.25);
    }
    .spend-badge {
      width: 32px; height: 22px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; flex-shrink: 0;
    }
    .spend-info { flex: 1; min-width: 0; }
    .spend-name { font-size: 12px; font-weight: 600; color: var(--text); }
    .spend-cards { font-family: 'Geist Mono', monospace; font-size: 9px; color: var(--text3); margin-top: 1px; }
    .spend-rate {
      font-family: 'Geist Mono', monospace; font-size: 17px;
      color: var(--text2); flex-shrink: 0; text-align: right;
    }
    .spend-rate small { display: block; font-size: 8px; color: var(--text3); letter-spacing: 0.06em; }
    .spend-rate-top { color: var(--tally-green); }
    .spend-note {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); line-height: 1.5; margin-top: 10px; letter-spacing: 0.04em;
    }

    /* Reachable Partners */
    .reach-section {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden; margin-bottom: 14px;
    }
    .reach-toggle {
      width: 100%; background: none; border: none; cursor: pointer;
      display: flex; align-items: center; gap: 8px;
      padding: 13px 16px; text-align: left;
      font-family: 'Geist', sans-serif; font-size: 13px;
      font-weight: 500; color: var(--text);
      -webkit-tap-highlight-color: transparent;
    }
    .reach-badge {
      background: var(--tally-green); color: white;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      border-radius: 20px; padding: 1px 7px; letter-spacing: 0.06em;
    }
    .reach-chevron { font-size: 8px; color: var(--text3); margin-left: auto; }
    .reach-body { padding: 0 14px 14px; }
    .reach-note {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); letter-spacing: 0.04em; margin-bottom: 10px;
    }
    .reach-list { display: flex; flex-direction: column; gap: 6px; }
    .reach-row {
      display: flex; align-items: center; gap: 10px;
      padding: 6px 8px; border-radius: 8px;
      border: 1px solid transparent; transition: border-color 0.15s;
    }
    .reach-row.reach-top {
      background: var(--tally-green-light); border-color: rgba(26,122,74,0.2);
    }
    .reach-icon { font-size: 16px; width: 22px; text-align: center; flex-shrink: 0; }
    .reach-info { flex: 1; min-width: 0; }
    .reach-name { font-size: 12px; font-weight: 500; color: var(--text); }
    .reach-via {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); letter-spacing: 0.04em; margin-top: 1px;
    }
    .reach-cpp {
      font-family: 'Geist Mono', monospace; font-size: 14px;
      color: var(--text2); text-align: right; flex-shrink: 0;
    }
    .reach-cpp small { font-size: 9px; color: var(--text3); }
    .reach-cpp.great { color: var(--tally-green); font-weight: 600; }

    /* Transfer Route Finder */
    .tf-inputs { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
    .tf-results { display: flex; flex-direction: column; gap: 8px; }
    .tf-row {
      display: flex; align-items: center; gap: 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px 12px;
    }
    .tf-row.tf-covered { border-color: rgba(26,122,74,0.3); background: var(--tally-green-light); }
    .tf-source-badge {
      width: 30px; height: 20px; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; flex-shrink: 0;
    }
    .tf-source-info { flex: 1; min-width: 0; }
    .tf-source-name { font-size: 12px; font-weight: 600; color: var(--text); }
    .tf-source-ratio { font-family: 'Geist Mono', monospace; font-size: 9px; color: var(--text3); margin-top: 1px; }
    .tf-coverage {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); text-align: right; flex-shrink: 0;
    }
    .tf-cov-ok { color: var(--tally-green); font-weight: 600; }
    .tf-check { margin-left: 4px; }
    .tf-empty { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 16px; text-align: center; font-size: 12px; color: var(--text3); line-height: 1.5; }
    .tf-hint { font-family: 'Geist Mono', monospace; font-size: 10px; color: var(--text3); line-height: 1.5; letter-spacing: 0.04em; }

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
  cardSort = signal<CardSortMode>('default');
  greatOnly = signal(false);
  showHeldOnly = signal(false);

  readonly cardSortModes: { id: CardSortMode; label: string }[] = [
    { id: 'default', label: 'Default' },
    { id: 'cpp',     label: '↑ Best CPP' },
    { id: 'balance', label: '↑ My Points' },
  ];

  // Spend category recommender
  showSpendRec = signal(false);
  selectedSpendCat = signal<SpendCat>('travel');

  readonly spendCats: { id: SpendCat; icon: string; label: string }[] = [
    { id: 'travel',    icon: '✈',  label: 'Travel'    },
    { id: 'dining',    icon: '🍽',  label: 'Dining'    },
    { id: 'groceries', icon: '🛒',  label: 'Groceries' },
    { id: 'gas',       icon: '⛽',  label: 'Gas'       },
    { id: 'online',    icon: '🛍',  label: 'Online'    },
    { id: 'general',   icon: '💳',  label: 'General'   },
  ];

  // Reachable partners panel
  showReachable = signal(false);

  /**
   * All unique airline + hotel partners reachable from the user's held programs,
   * at the best available CPP, sorted descending.
   */
  readonly reachablePartners = computed((): { name: string; icon: string; cpp: number; via: string }[] => {
    const seen = new Map<string, { name: string; icon: string; cpp: number; via: string }>();
    for (const card of this.data.cards) {
      if (this.wallet.getBalance(card.id) <= 0) continue;
      for (const p of card.partners) {
        const existing = seen.get(p.name);
        if (!existing || p.cpp > existing.cpp) {
          seen.set(p.name, { name: p.name, icon: p.icon, cpp: p.cpp, via: card.short ?? card.name });
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.cpp - a.cpp);
  });

  // Transfer Route Finder
  showTransferFinder = signal(false);
  tfTargetPartner = '';
  tfTargetMiles = 0;

  /** Deduplicated list of all partner names across all cards, sorted A-Z */
  readonly allPartnerNames: string[] = Array.from(
    new Set(this.data.cards.flatMap(c => c.partners.map(p => p.name)))
  ).sort();

  /** Cards that transfer to the selected target, with computed coverage */
  readonly tfRoutes = computed(() => {
    if (!this.tfTargetPartner) return [];
    const needed = this.tfTargetMiles;
    return this.data.cards
      .flatMap(card => {
        const partner = card.partners.find(p => p.name === this.tfTargetPartner);
        if (!partner) return [];
        // Parse ratio "1:1", "1:2", "2:3" → srcNeeded = needed * (from/to)
        const [from, to] = partner.ratio.split(':').map(Number);
        const srcNeeded = needed > 0 ? Math.ceil(needed * (from / to)) : 0;
        const balance = this.wallet.getBalance(card.id);
        return [{ card, ratio: partner.ratio, srcNeeded, balance, covered: balance >= srcNeeded && srcNeeded > 0 }];
      })
      .sort((a, b) => {
        if (a.covered !== b.covered) return a.covered ? -1 : 1;
        return a.srcNeeded - b.srcNeeded;
      });
  });

  /** Top 3 programs sorted by earn rate for the selected category */
  readonly bestForCategory = computed(() => {
    const cat = this.selectedSpendCat();
    return this.data.cards
      .map(card => ({ card, rate: EARN_RATES[card.id]?.[cat] ?? 1 }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 3);
  });

  /** Set of card IDs that currently have at least one active transfer bonus */
  private readonly _activeBonusIds = (() => {
    const today = new Date().toISOString().slice(0, 10);
    return new Set(
      this.data.transferBonuses
        .filter(b => b.expires >= today)
        .map(b => b.fromId)
    );
  })();

  hasActiveBonus(cardId: string): boolean {
    return this._activeBonusIds.has(cardId);
  }

  // Accordion: set of manually expanded card ids
  expandedCards = signal<Set<string>>(new Set());

  /** When searching by partner name, auto-expand matching program cards */
  readonly autoExpandedCards = computed<Set<string>>(() => {
    const q = this.searchRaw.toLowerCase().trim();
    if (!q) return new Set();
    const ids = new Set<string>();
    for (const card of this.data.cards) {
      const nameMatch =
        card.name.toLowerCase().includes(q) ||
        card.cards.some(c => c.toLowerCase().includes(q));
      const partnerMatch = card.partners.some(p => p.name.toLowerCase().includes(q));
      // Only auto-expand when the search specifically targets a partner (not the program itself)
      if (partnerMatch && !nameMatch) ids.add(card.id);
    }
    return ids;
  });

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
    const heldOnly = this.showHeldOnly();
    const sort = this.cardSort();

    let cards = this.data.cards.filter(card => {
      if (cat !== 'all' && card.category !== cat) return false;

      // Mine filter: only show programs with a balance
      if (heldOnly && this.wallet.getBalance(card.id) <= 0) return false;

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

    // Apply sort
    if (sort === 'cpp') {
      cards = [...cards].sort((a, b) => this.getBestCpp(b) - this.getBestCpp(a));
    } else if (sort === 'balance') {
      cards = [...cards].sort((a, b) => this.wallet.getBalance(b.id) - this.wallet.getBalance(a.id));
    }

    return cards;
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

  greatPartnerCount(card: CreditCard): number {
    return card.partners.filter(p => p.quality === 'great').length;
  }

  isExpanded(cardId: string): boolean {
    return this.expandedCards().has(cardId) || this.autoExpandedCards().has(cardId);
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

  private readonly PRO_TIPS: Partial<Record<string, string>> = {
    amex_mr:         'Never transfer without first checking for active bonuses — Amex runs 20–40% promos 2–4× per year. ANA and Singapore are typically the highest-value partners.',
    chase_ur:        'World of Hyatt at 1:1 is the best hotel redemption in points — hard to beat. Avoid IHG and Marriott unless you need the specific property.',
    citi_ty:         'Turkish Miles&Smiles is the crown jewel — Star Alliance Business at 45K pts. Book on Turkish.com only. Always try at midnight Istanbul time for best availability.',
    cap1_miles:      'Turkish and Avianca are your sweet spots here. Verify ratios before every transfer — some partners do not receive 1:1.',
    bilt:            'Alaska MileagePlan is your competitive edge — the only transferable program that partners with Alaska. Best for Cathay Pacific Business and JAL awards.',
    delta_skymiles:  'SkyMiles are best redeemed directly on Delta or transferred to Virgin Atlantic for ANA redemptions. Avoid transferring back to other programs.',
    united_mp:       'United Saver awards offer the best value. Use the Excursionist perk to add a free one-way segment on multi-city itineraries.',
    aa_aadvantage:   'AAdvantage shines with British Airways Avios on short-haul. Web Specials on AA.com drop on Tuesdays — set alerts for Mexico and Caribbean.',
    southwest_rr:    'The Companion Pass is the best deal in domestic travel. Time your big spend in January to unlock the pass for two calendar years.',
    alaska_mp:       'Alaska has the most diverse partner roster of any US airline — perfect for premium cabin awards on Cathay, JAL, British Airways, and more.',
    hyatt:           'Hyatt delivers the most consistent CPP of any hotel program. Stacking Chase UR → Hyatt and booking Park Hyatt or Andaz is a reliable 2–3¢/pt strategy.',
    marriott_bonvoy: 'The 5th night free benefit is Bonvoy\'s best feature — always book in multiples of 5 when using points. Avoid cash + points; it rarely makes sense.',
    hilton_honors:   'Hilton Honors CPP is low, but the Aspire card free night cert + Diamond status can make it worthwhile. The Conrad Bora Bora is one exception for elite CPP.',
    ihg_rewards:     'The IHG Premier free night cert is often worth more than the annual fee alone. Use it at an InterContinental for maximum value. Points are otherwise low-CPP.',
  };

  getProTip(cardId: string): string | null {
    return this.PRO_TIPS[cardId] ?? null;
  }

  /** Returns earn rate chips for all spending categories for a given card */
  getEarnRates(cardId: string): { icon: string; rate: number; best: boolean }[] {
    const rates = EARN_RATES[cardId];
    if (!rates) return [];
    const catIcons: Record<SpendCat, string> = {
      travel: '✈', dining: '🍽', groceries: '🛒', gas: '⛽', online: '🛍', general: '💳',
    };
    const entries = (Object.entries(rates) as [SpendCat, number][])
      .map(([cat, rate]) => ({ icon: catIcons[cat], rate, best: false }));
    const maxRate = Math.max(...entries.map(e => e.rate));
    entries.forEach(e => { e.best = e.rate === maxRate && maxRate > 1; });
    return entries;
  }

  clearAll(): void {
    this.searchRaw = '';
    this.activeCat.set('all');
    this.cardSort.set('default');
    this.greatOnly.set(false);
    this.showHeldOnly.set(false);
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

  /** Typical transfer posting time for a given source → partner pair */
  getTransferTime(cardId: string, partnerName: string): string {
    return TRANSFER_TIMES[cardId]?.[partnerName] ?? 'Typically 1–5 business days';
  }

  isInstantTransfer(cardId: string, partnerName: string): boolean {
    return this.getTransferTime(cardId, partnerName) === 'Instant';
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

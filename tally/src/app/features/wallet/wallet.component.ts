import { Component, inject, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WalletService, HistoryEntry } from '../../core/services/wallet.service';
import { DataService } from '../../core/services/data.service';
import { OptimizerService } from '../../core/services/optimizer.service';
import { ExpiryService } from '../../core/services/expiry.service';
import { NavigationService } from '../../core/services/navigation.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { CreditCard, TransferBonus, UserPreference } from '../../core/models';
import { OnboardingComponent } from '../../shared/components/onboarding/onboarding.component';
import { ToastService } from '../../core/services/toast.service';

const MAX_BALANCE = 50_000_000;
const GOAL_KEY = 'tally_wallet_goal_v1';

interface WalletGoalState {
  name: string;
  points: number;
  expanded: boolean;
}

type WalletProgramFilter = 'all' | 'held' | 'balance';

@Component({
  selector: 'tally-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule, OnboardingComponent],
  template: `
    <div class="page-content">
      <div class="section-eyebrow">My Points Wallet</div>
      <h2 class="section-title">Enter your <em>balances</em></h2>

      <!-- New user onboarding checklist -->
      <tally-onboarding *ngIf="wallet.syncState() !== 'loading'" />

      <!-- Sync status pill -->
      <div class="sync-pill" [class]="wallet.syncState()" aria-live="polite">
        <span class="sync-dot"></span>
        <span class="sync-text">{{ syncLabel() }}</span>
        <button
          type="button"
          *ngIf="wallet.syncState() === 'error'"
          class="sync-retry"
          (click)="wallet.retryLoad()"
        >Retry</button>
      </div>

      <section class="prefs-panel" *ngIf="wallet.syncState() !== 'loading'" aria-labelledby="wallet-prefs-title">
        <div class="prefs-head">
          <div>
            <span class="prefs-kicker">Trip defaults</span>
            <h3 id="wallet-prefs-title">Search preferences</h3>
          </div>
          <span class="prefs-status" [class.error]="prefs.syncState() === 'error'">
            {{ preferenceSyncLabel() }}
          </span>
        </div>
        <div class="prefs-grid">
          <label class="pref-field">
            <span>Home airports</span>
            <input
              class="pref-input"
              type="text"
              inputmode="text"
              autocomplete="off"
              [ngModel]="prefs.preferences().homeAirports.join(', ')"
              (ngModelChange)="updateHomeAirports($event)"
              placeholder="OMA, ORD">
          </label>
          <label class="pref-field">
            <span>Preferred cabin</span>
            <select
              class="pref-input"
              [ngModel]="prefs.preferences().preferredCabin"
              (ngModelChange)="updatePreference('preferredCabin', $event)">
              <option value="economy">Economy</option>
              <option value="premium">Premium economy</option>
              <option value="business">Business</option>
              <option value="first">First</option>
            </select>
          </label>
          <label class="pref-field">
            <span>Travelers</span>
            <input
              class="pref-input"
              type="number"
              min="1"
              max="9"
              inputmode="numeric"
              [ngModel]="prefs.preferences().defaultTravelers"
              (ngModelChange)="updatePreference('defaultTravelers', clampTravelers($event))">
          </label>
          <label class="pref-field">
            <span>Date flexibility</span>
            <select
              class="pref-input"
              [ngModel]="prefs.preferences().dateFlexibility"
              (ngModelChange)="updatePreference('dateFlexibility', $event)">
              <option value="exact">Exact dates</option>
              <option value="plus_minus_3">±3 days</option>
              <option value="plus_minus_7">±7 days</option>
              <option value="month">Whole month</option>
              <option value="next_60_days">Next 60 days</option>
            </select>
          </label>
        </div>
      </section>

      <!-- Loading shimmer -->
      <ng-container *ngIf="wallet.syncState() === 'loading'">
        <div class="wallet-list">
          <div class="shimmer-row shimmer-skeleton" *ngFor="let n of [1,2,3,4,5]"></div>
        </div>
      </ng-container>

      <!-- Points at Risk banner -->
      <div class="at-risk-banner" *ngIf="wallet.syncState() !== 'loading' && atRiskSummary() as r">
        <div class="arb-icon">⚠️</div>
        <div class="arb-body">
          <div class="arb-title">{{ r.pts | number }} points at risk</div>
          <div class="arb-sub">{{ r.programs }} program{{ r.programs !== 1 ? 's' : '' }} expiring within 90 days</div>
        </div>
          <button type="button" class="arb-action" (click)="nav.navigateTo({ tab: 'expiry' })">Review →</button>
      </div>

      <!-- Program groups -->
      <ng-container *ngIf="wallet.syncState() !== 'loading'">
        <div class="action-row wallet-filter-bar" role="radiogroup" aria-label="Wallet program filter">
          <button
            type="button"
            *ngFor="let filter of walletFilters"
            class="goal-toggle wallet-filter-btn"
            role="radio"
            [class.active]="walletProgramFilter() === filter.id"
            [attr.aria-checked]="walletProgramFilter() === filter.id"
            (click)="setWalletProgramFilter(filter.id)">
            {{ filter.label }} {{ filter.count() }}
          </button>
        </div>

        <div *ngFor="let group of visibleProgramGroups()" class="program-group">
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
                <!-- Expiry warning badge — only shown when points at risk -->
                <div class="expiry-badge" *ngIf="getExpiryBadge(card.id) as badge"
                  [class]="'expiry-badge expiry-badge-' + badge.level">
                  {{ badge.label }}
                </div>
              </div>
              <div class="program-actions">
                <button
                  *ngIf="!hasBalance(card.id); else balanceBackedHeld"
                  type="button"
                  class="goal-toggle held-toggle"
                  [class.active]="isHeldProgram(card.id)"
                  [attr.aria-pressed]="isHeldProgram(card.id)"
                  [attr.aria-label]="heldToggleLabel(card.id, card.name)"
                  [title]="heldToggleLabel(card.id, card.name)"
                  (click)="toggleHeldProgram(card.id); $event.stopPropagation()">
                  {{ heldToggleText(card.id) }}
                </button>
                <ng-template #balanceBackedHeld>
                  <span
                    class="goal-toggle held-toggle held-status-chip balance-backed"
                    role="status"
                    [attr.aria-label]="heldToggleLabel(card.id, card.name)"
                    [title]="heldToggleLabel(card.id, card.name)">
                    {{ heldToggleText(card.id) }}
                  </span>
                </ng-template>
                <div class="input-wrap" (click)="toggleExpand(card.id)">
                  <input
                    class="balance-input"
                    type="number"
                    inputmode="numeric"
                    placeholder="0"
                    [attr.aria-label]="card.name + ' point balance'"
                    [value]="wallet.getBalance(card.id) || null"
                    (click)="$event.stopPropagation()"
                    (focus)="expandedCard.set(card.id)"
                    (input)="onInput(card.id, $event)"
                    min="0" max="50000000" step="1000">
                  <div class="row-value" *ngIf="wallet.getBalance(card.id) > 0">
                    ~\${{ rowValue(card) | number }}
                  </div>
                </div>
              </div>
              <!-- Quick-add buttons — only show when expanded -->
              <div class="quick-add" *ngIf="expandedCard() === card.id">
                <button type="button" *ngFor="let inc of quickIncrements"
                  class="qa-btn"
                  [attr.aria-label]="'Add ' + inc.toLocaleString() + ' points to ' + card.name"
                  (click)="quickAdd(card.id, inc)">
                  +{{ formatInc(inc) }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="summary-note" *ngIf="visibleProgramGroups().length === 0">
          <strong>No programs match this filter.</strong>
          <span>Save a program with “I have this” or add a balance to bring it into Mine.</span>
        </div>
      </ng-container>

      <!-- Spending Simulator -->
      <div class="spend-sim" *ngIf="wallet.syncState() !== 'loading'">
        <div class="spend-sim-header">
          <span class="spend-sim-label">Earning simulator</span>
          <button type="button" class="goal-toggle" aria-controls="wallet-earning-simulator"
            [attr.aria-expanded]="showSim()" (click)="showSim.set(!showSim())">
            {{ showSim() ? 'Hide' : 'Show' }}
          </button>
        </div>
        <ng-container *ngIf="showSim()">
          <div id="wallet-earning-simulator">
          <div class="spend-sim-body">
            <div class="sim-field">
              <label class="field-label-sm" for="wallet-sim-monthly-spend">Monthly spend ($)</label>
              <input id="wallet-sim-monthly-spend" class="sim-input" type="number" inputmode="numeric"
                [(ngModel)]="simMonthlySpend" placeholder="2000" min="0" step="500">
            </div>
            <div class="sim-field">
              <label class="field-label-sm" for="wallet-sim-earn-rate">Earn rate (pts/$)</label>
              <input id="wallet-sim-earn-rate" class="sim-input" type="number" inputmode="decimal"
                [(ngModel)]="simEarnRate" placeholder="2" min="0.5" step="0.5">
            </div>
          </div>
          <div class="sim-results" *ngIf="simMonthlySpend > 0 && simEarnRate > 0">
            <div class="sim-row">
              <span class="sim-val">{{ simMonthlyEarn() | number }}</span>
              <span class="sim-key">pts/month</span>
            </div>
            <div class="sim-row">
              <span class="sim-val">{{ simYearlyEarn() | number }}</span>
              <span class="sim-key">pts/year</span>
            </div>
            <div class="sim-note" *ngIf="nextMilestone() as m">
              At this rate: <strong>{{ simMonthsToMilestone(m.gap) }} month{{ simMonthsToMilestone(m.gap) !== 1 ? 's' : '' }}</strong>
              to close the gap to <em>{{ m.name }}</em>
            </div>
          </div>
          </div>
        </ng-container>
      </div>

      <div class="divider"></div>

      <!-- Personalized Insights -->
      <div class="insights-strip" *ngIf="insights().length > 0">
        <div class="insights-label">✦ Insights</div>
        <div class="insight-card" *ngFor="let ins of insights()">
          <span class="ins-icon">{{ ins.icon }}</span>
          <div class="ins-body">
            <div class="ins-title">{{ ins.title }}</div>
            <div class="ins-sub">{{ ins.sub }}</div>
          </div>
        </div>
      </div>

      <!-- Points Health Score -->
      <div class="health-score-card" *ngIf="wallet.hasAnyPoints() && healthScore() as hs">
        <div class="hs-left">
          <div class="hs-label">Portfolio Health</div>
          <div class="hs-grade" [class]="hs.grade.toLowerCase()">{{ hs.grade }}</div>
          <div class="hs-score">{{ hs.score }}/100</div>
        </div>
        <div class="hs-right">
          <div class="hs-bar-wrap">
            <div class="hs-bar" [style.width]="hs.score + '%'" [class]="hs.grade.toLowerCase()"></div>
          </div>
          <div class="hs-tip">{{ hs.tip }}</div>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Point Goal Tracker -->
      <div class="goal-section">
        <div class="goal-header">
          <span class="goal-label">Point Goal</span>
          <button type="button" class="goal-toggle" aria-controls="wallet-goal-panel"
            [attr.aria-expanded]="showGoal()" (click)="toggleGoal()">
            {{ showGoal() ? 'Hide' : 'Set Goal' }}
          </button>
        </div>
        <ng-container *ngIf="showGoal()">
          <div id="wallet-goal-panel" class="goal-inputs">
            <input class="goal-name-input" aria-label="Point goal name" [ngModel]="goalName" (ngModelChange)="updateGoalName($event)" placeholder="e.g. Tokyo Business Class">
            <input class="goal-pts-input" type="number" inputmode="numeric" [ngModel]="goalPts" (ngModelChange)="updateGoalPoints($event)"
              aria-label="Point goal amount" placeholder="60000" min="0" step="5000">
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
        <div class="summary-sub">{{ wallet.totalPoints() | number }} total points · at best available CPP</div>
        <div class="weekly-change" *ngIf="weeklyChange() as wc"
          [class.positive]="wc.delta > 0" [class.negative]="wc.delta < 0">
          {{ wc.delta > 0 ? '▲' : '▼' }} {{ (wc.delta > 0 ? wc.delta : -wc.delta) | number }} this week
        </div>

        <!-- Portfolio breakdown bar -->
        <div class="breakdown-wrap" *ngIf="portfolioBreakdown() as b">
          <div class="breakdown-label">Portfolio mix</div>
          <div class="breakdown-bar">
            <div class="breakdown-seg seg-transfer" [style.width]="b.transferPct + '%'"
              [title]="'Transferable: ' + b.transferPct + '%'"></div>
            <div class="breakdown-seg seg-airline" [style.width]="b.airlinePct + '%'"
              [title]="'Airline: ' + b.airlinePct + '%'"></div>
            <div class="breakdown-seg seg-hotel" [style.width]="b.hotelPct + '%'"
              [title]="'Hotel: ' + b.hotelPct + '%'"></div>
          </div>
          <div class="breakdown-legend">
            <span class="bd-dot transfer"></span><span>Transfer {{b.transferPct}}%</span>
            <span class="bd-dot airline" *ngIf="b.airlinePct > 0"></span><span *ngIf="b.airlinePct > 0">Airline {{b.airlinePct}}%</span>
            <span class="bd-dot hotel" *ngIf="b.hotelPct > 0"></span><span *ngIf="b.hotelPct > 0">Hotel {{b.hotelPct}}%</span>
          </div>
        </div>

        <!-- Sparkline — only shown when there are at least 2 history entries -->
        <div class="sparkline-wrap" *ngIf="sparklinePoints()">
          <span class="sparkline-label">30-day trend</span>
          <svg class="sparkline" viewBox="0 0 100 28" preserveAspectRatio="none">
            <polyline [attr.points]="sparklinePoints()!" fill="none" stroke="currentColor"
              stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- Transfer Value Calculator -->
        <div class="transfer-calc" *ngIf="isTransferCalculatorRelevant()">
          <div class="tc-header">
            <span class="tc-label">Transfer Calculator</span>
            <button type="button" class="goal-toggle" aria-controls="wallet-transfer-calculator"
              [attr.aria-expanded]="showTransferCalc()" (click)="showTransferCalc.set(!showTransferCalc())">
              {{ showTransferCalc() ? 'Hide' : 'Show' }}
            </button>
          </div>
          <ng-container *ngIf="showTransferCalc()">
            <div id="wallet-transfer-calculator">
            <div class="summary-note tc-empty-note" *ngIf="fundedCards().length === 0">
              Saved programs with no balance are tracked in Mine. Add points to a program before using it as a transfer source.
            </div>
            <div class="tc-row">
              <div class="tc-field">
                <label class="field-label-sm" for="wallet-tc-source">From</label>
                <select id="wallet-tc-source" class="sim-input tc-select" [(ngModel)]="tcSourceCardId"
                  (ngModelChange)="tcDestPartner = ''">
                  <option value="">— select —</option>
                  <option *ngFor="let c of fundedCards()" [value]="c.id">{{ c.name }}</option>
                </select>
              </div>
              <div class="tc-field" *ngIf="tcSourceCardId">
                <label class="field-label-sm" for="wallet-tc-destination">To partner</label>
                <select id="wallet-tc-destination" class="sim-input tc-select" [(ngModel)]="tcDestPartner">
                  <option value="">— select —</option>
                  <option *ngFor="let p of tcSourcePartners()" [value]="p.name">
                    {{ p.icon }} {{ p.name }}
                  </option>
                </select>
              </div>
              <div class="tc-field" *ngIf="tcDestPartner">
                <label class="field-label-sm" for="wallet-tc-amount">Points to transfer</label>
                <input id="wallet-tc-amount" class="sim-input" type="number" inputmode="numeric"
                  [(ngModel)]="tcAmount" placeholder="{{ wallet.getBalance(tcSourceCardId) | number }}"
                  min="0" step="1000">
              </div>
            </div>
            <div class="tc-result" *ngIf="tcCalcResult() as r">
              <div class="tc-res-bonus" *ngIf="r.bonus">
                ⚡ {{ r.bonus.bonus }} transfer bonus active → {{ r.bonus.to }}
              </div>
              <div class="tc-res-row">
                <div class="tc-res-block">
                  <span class="tc-res-val">{{ r.finalPoints | number }}</span>
                  <span class="tc-res-key">{{ r.partner.name }} miles</span>
                </div>
                <div class="tc-res-sep">≈</div>
                <div class="tc-res-block">
                  <span class="tc-res-val tc-cash">\${{ r.cashValue | number }}</span>
                  <span class="tc-res-key">est. cash value</span>
                </div>
                <div class="tc-res-block" *ngIf="r.bonusPct > 0">
                  <span class="tc-res-val tc-bonus">+{{ r.bonusExtra | number }}</span>
                  <span class="tc-res-key">bonus miles</span>
                </div>
              </div>
              <div class="tc-res-cpp">at {{ r.partner.cpp }}¢/pt</div>
            </div>
            </div>
          </ng-container>
        </div>

        <div class="maximize-btn-row">
          <button type="button" class="maximize-btn" (click)="nav.navigateTo({ tab: 'optimizer' })">
            ⚡ Find best redemption in Optimizer →
          </button>
        </div>

        <div class="summary-note">
          Estimated using the best CPP partner for each program. Actual value depends on
          availability — use the Optimizer to find and book specific redemptions.
        </div>
        <div class="action-row">
          <button type="button" class="action-btn" (click)="exportCsv()">↓ Export CSV</button>
          <button type="button" class="action-btn share-btn" (click)="copyShare()" [class.copied]="copied()">
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
    .sync-pill { margin-bottom: 20px; }
    .sync-retry {
      margin-left: auto; background: none; border: 1px solid currentColor;
      border-radius: 5px; font-family: 'Geist', sans-serif; font-size: 10px;
      font-weight: 500; color: inherit; padding: 2px 8px; cursor: pointer;
      opacity: 0.7; transition: opacity 0.15s; flex-shrink: 0;
    }
    .sync-retry:hover { opacity: 1; }

    .prefs-panel {
      background: linear-gradient(135deg, var(--surface), var(--white));
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 20px;
    }
    .prefs-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; margin-bottom: 12px;
    }
    .prefs-kicker { display: block; color: var(--tally-green); margin-bottom: 3px; }
    .prefs-head h3 {
      margin: 0; font-family: 'Instrument Serif', serif;
      font-size: 22px; font-weight: 400; color: var(--text);
    }
    .prefs-status { letter-spacing: 0.08em; color: var(--text3); white-space: nowrap; padding-top: 3px; }
    .prefs-status.error { color: var(--tally-amber); }
    .prefs-grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .pref-field { display: flex; flex-direction: column; gap: 5px; letter-spacing: 0.12em; color: var(--text3); }
    .pref-input {
      min-height: 44px; width: 100%;
      background: var(--white); border: 1.5px solid var(--border);
      border-radius: 10px; color: var(--text);
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 500;
      letter-spacing: 0; text-transform: none; padding: 10px 12px;
      outline: none;
    }
    .pref-input:focus-visible {
      border-color: var(--tally-green);
      box-shadow: 0 0 0 3px rgba(26, 122, 74, 0.14);
    }
    @media (max-width: 430px) {
      .prefs-grid { grid-template-columns: 1fr; }
    }

    .shimmer-row { height: 64px; margin-bottom: 10px; }

    .program-group { margin-bottom: 20px; }
    .group-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
      padding: 0 2px;
    }
    .group-icon { font-size: 13px; }
    .group-label { letter-spacing: 0.15em; color: var(--text3); flex: 1; }
    .group-total {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--tally-green); letter-spacing: 0.04em;
    }
    .wallet-filter-bar { justify-content: flex-start; margin: 8px 0 16px; overflow-x: auto; }
    .wallet-filter-btn, .held-toggle { white-space: nowrap; }
    .wallet-filter-btn.active, .held-toggle.active, .action-btn.share-btn.copied { border-color: rgba(26,122,74,0.35); background: var(--tally-green-light); color: var(--tally-green); }

    .wallet-list { display: flex; flex-direction: column; gap: 8px; }

    .wallet-row {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 14px; padding: 12px 14px;
      display: grid; grid-template-columns: 38px minmax(0, 1fr) auto;
      align-items: center; gap: 12px;
      min-height: 70px;
    }
    .card-badge {
      width: 38px; height: 26px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0;
    }
    .card-info { min-width: 0; }
    .card-name { font-size: 12px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-sub { font-size: 10px; color: var(--text3); font-family: 'Geist Mono', monospace; margin-top: 1px; }
    .insights-strip { padding: 4px 0 8px; }
    .insights-label { letter-spacing: 0.15em; color: var(--tally-green); margin-bottom: 10px; }
    .insight-card {
      display: flex; align-items: flex-start; gap: 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 11px 14px; margin-bottom: 7px;
    }
    .ins-icon { font-size: 16px; flex-shrink: 0; }
    .ins-body { flex: 1; min-width: 0; }
    .ins-title { font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .ins-sub { font-size: 11px; color: var(--text3); line-height: 1.45; }

    .health-score-card {
      display: flex; align-items: center; gap: 14px;
      background: var(--white); border: 1px solid var(--border);
      border-radius: 14px; padding: 14px 16px; margin-bottom: 20px;
    }
    .hs-left { text-align: center; flex-shrink: 0; min-width: 60px; }
    .hs-label { font-size: 8px; letter-spacing: 0.14em; color: var(--text3); margin-bottom: 4px; }
    .hs-grade {
      font-family: 'Instrument Serif', serif; font-size: 40px; line-height: 1;
      color: var(--text);
    }
    .hs-grade.a { color: var(--tally-green); }
    .hs-grade.b { color: var(--tally-green-mid); }
    .hs-grade.c { color: var(--tally-amber); }
    .hs-grade.d { color: var(--tally-red); }
    .hs-score {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); letter-spacing: 0.06em; margin-top: 2px;
    }
    .hs-right { flex: 1; min-width: 0; }
    .hs-bar-wrap {
      height: 5px; background: var(--border); border-radius: 99px;
      overflow: hidden; margin-bottom: 8px;
    }
    .hs-bar {
      height: 100%; border-radius: 99px;
      transition: width 0.7s cubic-bezier(0.34,1.56,0.64,1);
    }
    .hs-bar.a { background: var(--tally-green); }
    .hs-bar.b { background: var(--tally-green-mid); }
    .hs-bar.c { background: var(--tally-amber); }
    .hs-bar.d { background: var(--tally-red); }
    .hs-tip { font-size: 11px; color: var(--text2); line-height: 1.45; }

    .at-risk-banner {
      display: flex; align-items: center; gap: 10px;
      background: var(--tally-red-light);
      border: 1px solid rgba(220,38,38,0.2); border-radius: 12px;
      padding: 12px 14px; margin-bottom: 16px;
    }
    .arb-icon { font-size: 18px; flex-shrink: 0; }
    .arb-body { flex: 1; min-width: 0; }
    .arb-title {
      font-family: 'Geist Mono', monospace; font-size: 13px;
      font-weight: 600; color: var(--tally-red);
    }
    .arb-sub {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--tally-red); opacity: 0.8; margin-top: 2px;
      letter-spacing: 0.04em;
    }
    .arb-action {
      background: var(--tally-red); color: white;
      border: none; border-radius: 8px; padding: 8px 12px; min-height: 44px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.06em; cursor: pointer; flex-shrink: 0;
      transition: opacity 0.15s;
    }
    .arb-action:hover { opacity: 0.85; }

    .expiry-badge {
      display: inline-block; margin-top: 3px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.05em; padding: 2px 6px; border-radius: 4px;
    }
    .expiry-badge-critical {
      background: var(--tally-red-light); color: var(--tally-red);
      border: 1px solid rgba(220,38,38,0.2);
    }
    .expiry-badge-warning {
      background: rgba(217,119,6,0.07); color: var(--tally-amber);
      border: 1px solid rgba(217,119,6,0.2);
    }

    .balance-input {
      background: var(--surface); border: 1.5px solid var(--border2);
      border-radius: 9px; color: var(--tally-green);
      font-family: 'Geist Mono', monospace; font-size: 13px;
      min-height: 44px; padding: 9px 10px; width: 102px; text-align: right;
      outline: none; transition: border-color 0.15s;
      -moz-appearance: textfield;
    }
    .balance-input::-webkit-outer-spin-button,
    .balance-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .balance-input:focus { border-color: var(--tally-green); }
    .balance-input::placeholder { color: var(--border2); }

    .input-wrap {
      display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
      min-width: 102px;
      scroll-margin-bottom: 120px;
    }
    .program-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
    .held-toggle { background: var(--surface); }
    .held-status-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: default;
    }
    .held-toggle.balance-backed {
      cursor: default;
      border-style: dashed;
    }
    .row-value {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--tally-green-mid); letter-spacing: 0.04em;
    }

    .quick-add {
      grid-column: 1 / -1;
      display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px;
    }
    .qa-btn {
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2);
      border-radius: 6px; color: var(--tally-green);
      font-family: 'Geist Mono', monospace; font-size: 9px; letter-spacing: 0.06em;
      min-height: 44px; padding: 8px 10px; cursor: pointer; transition: background 0.12s;
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
    .weekly-change {
      font-family: 'Geist Mono', monospace; font-size: 11px;
      letter-spacing: 0.06em; margin-bottom: 12px;
    }
    .weekly-change.positive { color: var(--tally-green); }
    .weekly-change.negative { color: var(--tally-red); }
    .maximize-btn-row { margin-bottom: 14px; }
    .maximize-btn {
      width: 100%; background: var(--tally-green); color: white;
      border: none; border-radius: 10px; padding: 12px 16px;
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: opacity 0.15s; letter-spacing: 0.01em;
    }
    .maximize-btn:hover { opacity: 0.88; }

    .summary-note {
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2);
      border-radius: 10px; padding: 12px 16px;
      font-size: 13px; color: var(--tally-green); line-height: 1.5; text-align: left;
    }

    .goal-section { padding: 4px 0 8px; }
    .goal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .goal-label { letter-spacing: 0.15em; color: var(--text3); }
    .goal-toggle {
      background: none; border: 1px solid var(--border2); border-radius: 7px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; min-height: 44px; padding: 8px 12px; cursor: pointer; transition: all 0.15s;
    }
    .goal-toggle:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .goal-inputs { display: flex; gap: 8px; margin-bottom: 12px; }
    .goal-name-input {
      flex: 1; background: var(--white); border: 1.5px solid var(--border2);
      border-radius: 9px; font-family: 'Geist', sans-serif; font-size: 13px;
      color: var(--text); min-height: 44px; padding: 10px 12px; outline: none; transition: border-color 0.15s;
      min-width: 0;
    }
    .goal-name-input:focus { border-color: var(--tally-green); }
    .goal-name-input::placeholder { color: var(--text3); }
    .goal-pts-input {
      width: 90px; background: var(--white); border: 1.5px solid var(--border2);
      border-radius: 9px; font-family: 'Geist Mono', monospace; font-size: 13px;
      color: var(--tally-green); min-height: 44px; padding: 10px 12px; outline: none;
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

    .breakdown-wrap { margin: 12px 0 14px; }
    .breakdown-label { font-size: 8px; letter-spacing: 0.12em; color: var(--text3); margin-bottom: 5px; }
    .breakdown-bar {
      display: flex; height: 6px; border-radius: 99px; overflow: hidden; gap: 1px;
      background: var(--border); margin-bottom: 5px;
    }
    .breakdown-seg { height: 100%; min-width: 2px; }
    .breakdown-seg.seg-transfer { background: var(--tally-green); }
    .breakdown-seg.seg-airline  { background: #3b82f6; }
    .breakdown-seg.seg-hotel    { background: var(--tally-amber); }
    .breakdown-legend {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      font-family: 'Geist Mono', monospace; font-size: 8px; color: var(--text3);
    }
    .bd-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .bd-dot.transfer { background: var(--tally-green); }
    .bd-dot.airline  { background: #3b82f6; }
    .bd-dot.hotel    { background: var(--tally-amber); }

    .sparkline-wrap {
      display: flex; align-items: center; gap: 8px; margin: 10px 0 14px;
      color: var(--tally-green);
    }
    .sparkline-label { font-size: 8px; letter-spacing: 0.12em; color: var(--text3); white-space: nowrap; }
    .sparkline { flex: 1; height: 28px; }

    .action-row { display: flex; gap: 8px; margin-top: 14px; justify-content: center; }
    .action-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.1em; min-height: 44px; padding: 10px 14px; cursor: pointer;
      transition: all 0.15s; flex: 1; max-width: 140px;
    }
    .action-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }

    .spend-sim { margin-bottom: 20px; }
    .spend-sim-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .spend-sim-label { letter-spacing: 0.15em; color: var(--text3); }
    .spend-sim-body { display: flex; gap: 8px; margin-bottom: 12px; }
    .sim-field { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .field-label-sm { font-size: 8px; letter-spacing: 0.12em; color: var(--text3); }
    .sim-input {
      background: var(--white); border: 1.5px solid var(--border2);
      border-radius: 9px; color: var(--tally-green);
      font-family: 'Geist Mono', monospace; font-size: 14px;
      min-height: 44px; padding: 10px 12px; outline: none; transition: border-color 0.15s;
      -moz-appearance: textfield; width: 100%; box-sizing: border-box;
    }
    .sim-input::-webkit-outer-spin-button,
    .sim-input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .sim-input:focus { border-color: var(--tally-green); }
    .sim-results {
      background: var(--surface); border-radius: 10px; padding: 10px 12px;
      display: flex; gap: 16px; flex-wrap: wrap;
    }
    .sim-row { display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .sim-val {
      font-family: 'Geist Mono', monospace; font-size: 16px;
      color: var(--tally-green); font-weight: 600;
    }
    .sim-key {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      color: var(--text3); letter-spacing: 0.08em;
    }
    .sim-note {
      flex-basis: 100%; font-size: 12px; color: var(--text2); line-height: 1.5;
    }

    .milestone-card {
      display: flex; align-items: center; gap: 12px;
      background: var(--white); border: 1px solid var(--border);
      border-radius: 14px; padding: 14px 16px;
      margin: 0 0 20px;
    }
    .milestone-icon { font-size: 22px; flex-shrink: 0; }
    .milestone-body { flex: 1; min-width: 0; }
    .milestone-label { font-size: 8px; letter-spacing: 0.14em; color: var(--text3); margin-bottom: 2px; }
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

    .transfer-calc { margin-bottom: 20px; }
    .tc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .tc-label { letter-spacing: 0.15em; color: var(--text3); }
    .prefs-kicker, .pref-field, .group-label, .insights-label, .goal-label,
    .spend-sim-label, .tc-label {
      font-family: 'Geist Mono', monospace; font-size: 9px; text-transform: uppercase;
    }
    .hs-label, .breakdown-label, .sparkline-label, .field-label-sm, .milestone-label {
      font-family: 'Geist Mono', monospace; text-transform: uppercase;
    }
    .tc-row { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .tc-field { display: flex; flex-direction: column; gap: 4px; }
    .tc-select { width: 100%; }
    .tc-result {
      background: var(--surface); border-radius: 12px;
      padding: 14px 16px; animation: fadeIn 0.2s ease;
    }
    .tc-empty-note { margin-bottom: 10px; }
    .tc-res-bonus {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; color: var(--tally-amber);
      background: rgba(217,119,6,0.08); border: 1px solid rgba(217,119,6,0.2);
      border-radius: 6px; padding: 4px 10px; margin-bottom: 12px;
      display: inline-block;
    }
    .tc-res-row {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .tc-res-block { display: flex; flex-direction: column; align-items: center; gap: 1px; flex: 1; min-width: 70px; }
    .tc-res-sep { font-family: 'Geist Mono', monospace; font-size: 14px; color: var(--text3); }
    .tc-res-val {
      font-family: 'Geist Mono', monospace; font-size: 18px;
      color: var(--tally-green); font-weight: 600;
    }
    .tc-res-val.tc-cash { color: var(--text); }
    .tc-res-val.tc-bonus { color: var(--tally-amber); font-size: 14px; }
    .tc-res-key {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      color: var(--text3); letter-spacing: 0.08em; text-align: center;
    }
    .tc-res-cpp {
      margin-top: 8px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); letter-spacing: 0.06em; text-align: center;
    }
    @media (min-width: 760px) {
      .wallet-row { grid-template-columns: 38px minmax(220px, 1fr) minmax(240px, auto); }
      .quick-add { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .wallet-row {
        grid-template-columns: 38px minmax(0, 1fr);
        align-items: start;
      }
      .wallet-filter-bar { flex-direction: row; }
      .wallet-filter-btn { flex: 0 0 auto; }
      .program-actions {
        grid-column: 1 / -1; width: 100%; display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(126px, 0.8fr);
        align-items: stretch;
      }
      .input-wrap {
        width: 100%; min-width: 0; align-items: stretch;
      }
      .balance-input { width: 100%; text-align: left; }
      .row-value { text-align: right; }
      .held-toggle {
        min-width: 0; width: 100%; justify-content: center; white-space: normal;
      }
      .quick-add { gap: 5px; }
      .qa-btn { flex: 1 1 calc(50% - 6px); }
    }
    @media (max-width: 520px) {
      .at-risk-banner { align-items: flex-start; flex-wrap: wrap; }
      .arb-action { width: 100%; }
      .goal-inputs,
      .spend-sim-body {
        flex-direction: column;
      }
      .goal-pts-input { width: 100%; text-align: left; }
      .action-row { flex-direction: column; }
      .wallet-filter-bar { flex-direction: row; }
      .action-btn { max-width: none; }
    }
    @media (max-width:430px){.program-actions{grid-template-columns:1fr}.row-value{text-align:left}}
  `]
})
export class WalletComponent {
  wallet = inject(WalletService);
  data = inject(DataService);
  private optimizer = inject(OptimizerService);
  private expiry = inject(ExpiryService);
  private toast = inject(ToastService);
  prefs = inject(PreferencesService);
  nav = inject(NavigationService);
  private _allRecs = this.optimizer.getAllRecs();
  private readonly initialGoal = this.loadGoal();

  expandedCard = signal<string | null>(null);
  walletProgramFilter = signal<WalletProgramFilter>('all');
  readonly quickIncrements = [5_000, 10_000, 25_000, 50_000, 100_000];

  // Goal tracker
  showGoal = signal(this.initialGoal.expanded || this.initialGoal.points > 0 || !!this.initialGoal.name);
  goalName = this.initialGoal.name;
  goalPts = this.initialGoal.points;

  constructor() {
    effect(() => {
      this.showGoal();
      this.saveGoal();
    });
  }

  readonly goalPct = computed(() => {
    if (!this.goalPts) return 0;
    return Math.min(100, Math.round((this.wallet.totalPoints() / this.goalPts) * 100));
  });

  toggleGoal(): void {
    this.showGoal.update(v => !v);
  }

  updateGoalName(value: string): void {
    this.goalName = value;
    this.saveGoal();
  }

  updateGoalPoints(value: unknown): void {
    const parsed = typeof value === 'number' ? value : Number(value);
    this.goalPts = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
    this.saveGoal();
  }

  private loadGoal(): WalletGoalState {
    try {
      const raw = localStorage.getItem(GOAL_KEY);
      if (!raw) return { name: '', points: 0, expanded: false };
      const parsed = JSON.parse(raw) as Partial<WalletGoalState>;
      return {
        name: typeof parsed.name === 'string' ? parsed.name.slice(0, 120) : '',
        points: typeof parsed.points === 'number' && Number.isFinite(parsed.points) ? Math.max(0, Math.round(parsed.points)) : 0,
        expanded: parsed.expanded === true,
      };
    } catch {
      return { name: '', points: 0, expanded: false };
    }
  }

  private saveGoal(): void {
    try {
      localStorage.setItem(GOAL_KEY, JSON.stringify({
        name: this.goalName.slice(0, 120),
        points: Math.max(0, Math.round(Number(this.goalPts) || 0)),
        expanded: this.showGoal(),
      }));
    } catch {}
  }

  copied = signal(false);

  // Spending Simulator
  showSim = signal(false);
  simMonthlySpend = 2000;
  simEarnRate = 2; // pts per dollar

  readonly simMonthlyEarn = computed(() =>
    Math.round(this.simMonthlySpend * this.simEarnRate)
  );
  readonly simYearlyEarn = computed(() => this.simMonthlyEarn() * 12);

  preferenceSyncLabel(): string {
    switch (this.prefs.syncState()) {
      case 'loading': return 'Loading';
      case 'synced': return 'Saved';
      case 'error': return 'Offline saved';
      default: return 'Local';
    }
  }

  updateHomeAirports(value: string): void {
    const homeAirports = value
      .split(',')
      .map(code => code.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 5);
    this.prefs.updatePreferences({ homeAirports });
  }

  updatePreference<K extends keyof UserPreference>(key: K, value: UserPreference[K]): void {
    this.prefs.updatePreferences({ [key]: value } as Partial<UserPreference>);
  }

  clampTravelers(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return this.prefs.preferences().defaultTravelers;
    return Math.min(9, Math.max(1, Math.round(parsed)));
  }

  simMonthsToMilestone(gap: number): number {
    const monthly = this.simMonthlyEarn();
    if (!monthly) return 0;
    return Math.ceil(gap / monthly);
  }

  /** Breakdown of total points by category (transferable / airline / hotel) */
  readonly portfolioBreakdown = computed(() => {
    const total = this.wallet.totalPoints();
    if (total === 0) return null;

    let transfer = 0, airline = 0, hotel = 0;
    for (const card of this.data.cards) {
      const bal = this.wallet.getBalance(card.id);
      if (card.category === 'transferable') transfer += bal;
      else if (card.category === 'airline')  airline += bal;
      else if (card.category === 'hotel')    hotel += bal;
    }
    return {
      transferPct: Math.round((transfer / total) * 100),
      airlinePct:  Math.round((airline  / total) * 100),
      hotelPct:    Math.round((hotel    / total) * 100),
    };
  });

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

  readonly heldProgramIdSet = computed(() => new Set(this.prefs.preferences().heldProgramIds ?? []));

  readonly heldProgramCount = computed(() =>
    this.data.cards.filter(card => this.isHeldProgram(card.id)).length
  );

  readonly balanceProgramCount = computed(() =>
    this.data.cards.filter(card => this.wallet.getBalance(card.id) > 0).length
  );

  readonly walletFilters: Array<{ id: WalletProgramFilter; label: string; count: () => number }> = [
    { id: 'all', label: 'All', count: () => this.data.cards.length },
    { id: 'held', label: 'Mine', count: () => this.heldProgramCount() },
    { id: 'balance', label: 'With Balance', count: () => this.balanceProgramCount() },
  ];

  readonly visibleProgramGroups = computed(() => {
    const filter = this.walletProgramFilter();
    return this.programGroups
      .map(group => ({
        ...group,
        cards: group.cards.filter(card => {
          if (filter === 'held') return this.isHeldProgram(card.id);
          if (filter === 'balance') return this.wallet.getBalance(card.id) > 0;
          return true;
        }),
      }))
      .filter(group => group.cards.length > 0);
  });

  groupTotal(cards: CreditCard[]): number {
    return cards.reduce((sum, c) => sum + this.wallet.getBalance(c.id), 0);
  }

  setWalletProgramFilter(filter: WalletProgramFilter): void {
    this.walletProgramFilter.set(filter);
  }

  isExplicitHeldProgram(cardId: string): boolean {
    return this.heldProgramIdSet().has(cardId);
  }

  isHeldProgram(cardId: string): boolean {
    return this.isExplicitHeldProgram(cardId) || this.wallet.getBalance(cardId) > 0;
  }

  hasBalance(cardId: string): boolean {
    return this.wallet.getBalance(cardId) > 0;
  }

  heldToggleText(cardId: string): string {
    if (this.hasBalance(cardId)) return 'Balance saved';
    return this.isExplicitHeldProgram(cardId) ? 'Saved' : 'I have this';
  }

  heldToggleLabel(cardId: string, cardName: string): string {
    if (this.hasBalance(cardId)) return `${cardName} is counted as yours because it has a saved balance`;
    return this.isExplicitHeldProgram(cardId)
      ? `Remove ${cardName} from your programs`
      : `Save ${cardName} as a program you have`;
  }

  toggleHeldProgram(cardId: string): void {
    if (this.wallet.getBalance(cardId) > 0) return;
    const current = this.prefs.preferences().heldProgramIds ?? [];
    const next = new Set(current);
    if (next.has(cardId)) {
      next.delete(cardId);
    } else {
      next.add(cardId);
    }
    this.prefs.updatePreferences({ heldProgramIds: Array.from(next) });
  }

  private ensureHeldProgram(cardId: string): void {
    const current = this.prefs.preferences().heldProgramIds ?? [];
    if (current.includes(cardId)) return;
    this.prefs.updatePreferences({ heldProgramIds: [...current, cardId] });
  }

  syncLabel(): string {
    const pending = this.wallet.pendingCount();
    if (pending > 0) return `${pending} change${pending === 1 ? '' : 's'} pending`;
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
    this.wallet.setBalance(cardId, Math.min(MAX_BALANCE, this.wallet.getBalance(cardId) + amount));
    this.ensureHeldProgram(cardId);
  }

  formatInc(n: number): string {
    return n >= 1_000 ? `${n / 1_000}k` : `${n}`;
  }

  onInput(cardId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = Math.min(MAX_BALANCE, parseInt(input.value) || 0);
    if (String(val) !== input.value && input.value !== '') input.value = String(val);
    this.wallet.setBalance(cardId, val);
    if (val > 0) this.ensureHeldProgram(cardId);
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

    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clipboard?.writeText) {
      this.toast.error('Clipboard unavailable — export CSV instead');
      return;
    }

    clipboard.writeText(lines.join('\n')).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }).catch(() => this.toast.error('Could not copy wallet summary'));
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
    this.downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
      `tally-wallet-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /** 7-day point change from history (null when insufficient data) */
  readonly weeklyChange = computed((): { delta: number } | null => {
    const h = this.wallet.history();
    if (h.length < 2) return null;
    // History is ordered oldest-first; newest is at the end
    const latest = h[h.length - 1];
    const latestDate = new Date(latest.date);
    // Find the entry closest to 7 days ago (at least 6 full days back)
    const weekOld = h.find(e => {
      const d = new Date(e.date);
      return (latestDate.getTime() - d.getTime()) >= 6 * 24 * 60 * 60 * 1000;
    });
    if (!weekOld) return null;
    const delta = latest.total - weekOld.total;
    if (delta === 0) return null;
    return { delta };
  });

  /** Aggregates all at-risk balances across warning/critical/expired programs */
  readonly atRiskSummary = computed((): { pts: number; programs: number } | null => {
    let totalPts = 0;
    let count = 0;
    for (const s of this.expiry.statuses()) {
      if (s.urgency === 'safe' || s.urgency === 'never') continue;
      const bal = this.wallet.getBalance(s.cardId);
      if (bal <= 0) continue;
      totalPts += bal;
      count++;
    }
    return count > 0 ? { pts: totalPts, programs: count } : null;
  });

  /** Personalized insight cards based on user's held balances */
  readonly insights = computed((): { icon: string; title: string; sub: string }[] => {
    if (!this.wallet.hasAnyPoints()) return [];
    const result: { icon: string; title: string; sub: string }[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // Insight 1: Most valuable single program + best CPP partner
    let bestCard: { name: string; balance: number; cpp: number; partnerName: string } | null = null;
    for (const card of this.data.cards) {
      const bal = this.wallet.getBalance(card.id);
      if (bal <= 0) continue;
      const topPartner = card.partners.reduce(
        (max, p) => p.cpp > max.cpp ? p : max,
        card.partners[0]
      );
      if (!topPartner) continue;
      const value = bal * topPartner.cpp / 100;
      if (!bestCard || value > (bestCard.balance * bestCard.cpp / 100)) {
        bestCard = { name: card.name, balance: bal, cpp: topPartner.cpp, partnerName: topPartner.name };
      }
    }
    if (bestCard) {
      const estVal = Math.round(bestCard.balance * bestCard.cpp / 100);
      result.push({
        icon: '💎',
        title: `${bestCard.name} — best value`,
        sub: `${bestCard.balance.toLocaleString()} pts worth ~$${estVal.toLocaleString()} via ${bestCard.partnerName} at ${bestCard.cpp}¢/pt`,
      });
    }

    // Insight 2: Active transfer bonus for any held program
    const activeBonuses = (this.data.transferBonuses ?? []).filter(b => b.expires >= today);
    for (const bonus of activeBonuses) {
      const card = this.data.cards.find(c => c.id === bonus.fromId);
      if (!card || this.wallet.getBalance(card.id) <= 0) continue;
      const expLabel = bonus.expires.slice(0, 7).replace('-', '/');
      result.push({
        icon: '⚡',
        title: `Bonus active: ${card.name} → ${bonus.to}`,
        sub: `${bonus.bonus} extra miles until ${expLabel} — transfer now to maximise`,
      });
      break; // show at most one bonus insight
    }

    // Insight 3: Diversification tip — if one program is >70% of portfolio
    const total = this.wallet.totalPoints();
    if (total > 0) {
      for (const card of this.data.cards) {
        const bal = this.wallet.getBalance(card.id);
        if (bal / total > 0.7) {
          result.push({
            icon: '📊',
            title: `Heavy concentration in ${card.name}`,
            sub: `${Math.round((bal / total) * 100)}% of your portfolio — consider diversifying to keep options open`,
          });
          break;
        }
      }
    }

    return result.slice(0, 3);
  });

  /** Portfolio health score 0–100, letter grade A/B/C/D, and an actionable tip */
  readonly healthScore = computed((): { score: number; grade: 'A' | 'B' | 'C' | 'D'; tip: string } | null => {
    const total = this.wallet.totalPoints();
    if (total === 0) return null;

    let score = 100;
    let tip = 'Your points portfolio looks great!';

    // ── Penalty 1: At-risk points (expiry within 90 days) ──────────────────
    let atRiskPts = 0;
    for (const s of this.expiry.statuses()) {
      if (s.urgency === 'expired' || s.urgency === 'critical') {
        atRiskPts += this.wallet.getBalance(s.cardId);
      } else if (s.urgency === 'warning') {
        atRiskPts += this.wallet.getBalance(s.cardId) * 0.5;
      }
    }
    const atRiskPct = atRiskPts / total;
    const expiryPenalty = Math.min(35, Math.round(atRiskPct * 60));
    score -= expiryPenalty;
    if (expiryPenalty > 20) tip = 'Some points are expiring soon — mark activity in the Expiry tab.';
    else if (expiryPenalty > 5) tip = 'A few programs need attention — check your expiry dates.';

    // ── Penalty 2: Over-concentration ──────────────────────────────────────
    let maxSinglePct = 0;
    for (const card of this.data.cards) {
      const pct = this.wallet.getBalance(card.id) / total;
      if (pct > maxSinglePct) maxSinglePct = pct;
    }
    if (maxSinglePct > 0.85) {
      score -= 20;
      tip = 'All your points are in one program — diversify for more flexibility.';
    } else if (maxSinglePct > 0.70) {
      score -= 10;
      if (expiryPenalty <= 5) tip = 'Consider spreading points across 2–3 programs for more redemption options.';
    }

    // ── Penalty 3: No transferable currencies ──────────────────────────────
    const transferBal = this.data.cards
      .filter(c => c.category === 'transferable')
      .reduce((sum, c) => sum + this.wallet.getBalance(c.id), 0);
    if (transferBal === 0) {
      score -= 15;
      if (expiryPenalty <= 5 && maxSinglePct <= 0.70) {
        tip = 'You hold no transferable currencies (Amex MR, Chase UR, etc.) — these unlock the most partners.';
      }
    } else if (transferBal / total < 0.25) {
      score -= 7;
    }

    score = Math.max(0, Math.min(100, score));
    const grade: 'A' | 'B' | 'C' | 'D' =
      score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';

    return { score, grade, tip };
  });

  /** Returns a colored badge object for programs with at-risk points, or null. */
  getExpiryBadge(cardId: string): { label: string; level: 'critical' | 'warning' } | null {
    if (this.wallet.getBalance(cardId) <= 0) return null; // no points → no risk to show
    const status = this.expiry.statuses().find(s => s.cardId === cardId);
    if (!status) return null;
    switch (status.urgency) {
      case 'expired':  return { label: '⚠ Expired',                          level: 'critical' };
      case 'critical': return { label: `⚠ ${status.daysRemaining}d left`,   level: 'critical' };
      case 'warning':  return { label: `⏱ ${status.daysRemaining}d left`,   level: 'warning'  };
      default:         return null;
    }
  }

  // ── Transfer Calculator ────────────────────────────────────────────────────
  showTransferCalc = signal(false);
  tcSourceCardId = '';
  tcDestPartner = '';
  tcAmount = 0;

  /** Programs the user marked as theirs, including zero-balance programs. */
  readonly heldCards = computed(() =>
    this.data.cards.filter(c => this.isHeldProgram(c.id))
  );

  /** Programs with a positive balance that can act as transfer sources. */
  readonly fundedCards = computed(() =>
    this.data.cards.filter(c => this.wallet.getBalance(c.id) > 0)
  );

  isTransferCalculatorRelevant(): boolean {
    return this.heldCards().length > 0 || this.fundedCards().length > 0;
  }

  /** Transfer partners for the currently selected source card */
  readonly tcSourcePartners = computed(() => {
    const card = this.data.cards.find(c => c.id === this.tcSourceCardId);
    return card?.partners ?? [];
  });

  /** Full transfer calculation result, or null when inputs are incomplete */
  readonly tcCalcResult = computed((): {
    basePoints: number; bonusPct: number; bonusExtra: number;
    finalPoints: number; cashValue: number;
    partner: { name: string; icon: string; cpp: number };
    bonus: TransferBonus | undefined;
  } | null => {
    const card = this.data.cards.find(c => c.id === this.tcSourceCardId);
    const partnerName = this.tcDestPartner;
    const amount = Number(this.tcAmount) || this.wallet.getBalance(this.tcSourceCardId);
    if (!card || !partnerName || amount <= 0) return null;

    const partner = card.partners.find(p => p.name === partnerName);
    if (!partner) return null;

    const today = new Date().toISOString().slice(0, 10);
    const bonus = this.data.transferBonuses?.find(b =>
      b.fromId === card.id &&
      b.expires >= today &&
      (b.to.toLowerCase().includes(partnerName.toLowerCase().split('/')[0].trim()) ||
       partnerName.toLowerCase().includes(b.to.toLowerCase().split('/')[0].trim()))
    );

    const bonusPct = bonus ? parseInt(bonus.bonus) / 100 : 0;
    const bonusExtra = Math.floor(amount * bonusPct);
    const finalPoints = amount + bonusExtra;
    const cashValue = Math.round(finalPoints * partner.cpp / 100);

    return { basePoints: amount, bonusPct, bonusExtra, finalPoints, cashValue, partner, bonus };
  });
}

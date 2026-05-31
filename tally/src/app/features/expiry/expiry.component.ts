import { Component, OnDestroy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpiryService, ExpiryStatus, SyncState } from '../../core/services/expiry.service';
import { WalletService } from '../../core/services/wallet.service';
import { PreferencesService } from '../../core/services/preferences.service';

/** Direct links to the fastest activity-reset action for each program */
const PORTAL_LINKS: Partial<Record<string, Array<{ label: string; url: string }>>> = {
  citi_ty:        [{ label: 'Citi ThankYou Mall', url: 'https://shop.thankyou.com' }],
  bilt:           [{ label: 'Bilt Rewards App', url: 'https://biltrewards.com' }],
  united_mp:      [{ label: 'MileagePlus Shopping', url: 'https://shopping.mileageplus.com' }],
  aa_aadvantage:  [{ label: 'AAdvantage eShopping', url: 'https://aadvantageeshopping.com' }],
  southwest_rr:   [{ label: 'Rapid Rewards Shopping', url: 'https://rapidrewardsshopping.com' }],
  alaska_mp:      [{ label: 'MileagePlan Shopping', url: 'https://mileageplanshop.com' }],
  hyatt:          [{ label: 'Book a Hyatt stay', url: 'https://hyatt.com/awards' }],
  marriott_bonvoy:[{ label: 'Book a Marriott stay', url: 'https://marriott.com' }],
  hilton_honors:  [{ label: 'Book a Hilton stay', url: 'https://hilton.com' }],
  ihg_rewards:    [{ label: 'Book an IHG stay', url: 'https://ihg.com' }],
  singapore_kf:   [{ label: 'KrisFlyer Portal', url: 'https://www.singaporeair.com/en_UK/sg/ppsclub-krisflyer/krisflyer-spends/' }],
};
const EXPIRY_UI_STATE_KEY = 'tally_expiry_ui_session_v1';

@Component({
  selector: 'tally-expiry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content">
      <div class="section-eyebrow">Points Expiry Tracker</div>
      <h2 class="section-title">Don't let your <em>points die</em></h2>

      <!-- Sync status pill + bulk action row -->
      <div class="pill-row">
        <div class="sync-pill" [class]="expiry.syncState()" aria-live="polite">
          <span class="sync-dot"></span>
          <span class="sync-text">{{ syncLabel(expiry.syncState()) }}</span>
          <button
            type="button"
            *ngIf="expiry.syncState() === 'error'"
            class="sync-retry"
            (click)="expiry.retryLoad()">Retry</button>
        </div>
        <button type="button" class="bulk-today-btn"
          *ngIf="expiry.syncState() !== 'loading'"
          (click)="markAllToday()"
          [disabled]="bulkMarkableCount() === 0"
          [class.confirm]="bulkConfirm()"
          [class.done]="bulkDone()"
          [attr.aria-label]="bulkButtonAriaLabel()">
          {{ bulkButtonLabel() }}
        </button>
        <button type="button" class="filter-held-btn" *ngIf="hasAnyHeldPrograms()"
          [class.active]="showHeldOnly()"
          [attr.aria-pressed]="showHeldOnly()"
          (click)="toggleHeldOnly()">
          {{ showHeldOnly() ? '★ Mine' : '☆ Mine' }}
        </button>
      </div>

      <!-- Loading shimmer -->
      <div *ngIf="expiry.syncState() === 'loading'" class="shimmer-list">
        <div class="shimmer-card shimmer-skeleton" *ngFor="let n of [1,2,3]"></div>
      </div>

      <ng-container *ngIf="expiry.syncState() !== 'loading'">

      <!-- Critical alert banner -->
      <div class="alert-banner critical" *ngIf="visibleCriticalCount() > 0" aria-live="polite">
        <span class="alert-icon">⚠️</span>
        <div>
          <div class="alert-title">{{ alertScopeLabel() }}{{ visibleCriticalCount() }} program{{ visibleCriticalCount() > 1 ? 's' : '' }} need immediate attention</div>
          <div class="alert-sub">Points may expire within 30 days. Act now.</div>
        </div>
      </div>

      <!-- Warning banner (when no critical but have warnings) -->
      <div class="alert-banner warning" *ngIf="visibleCriticalCount() === 0 && visibleWarningCount() > 0" aria-live="polite">
        <span class="alert-icon">🔔</span>
        <div>
          <div class="alert-title">{{ alertScopeLabel() }}{{ visibleWarningCount() }} program{{ visibleWarningCount() > 1 ? 's' : '' }} need expiry review</div>
          <div class="alert-sub">Set missing dates or plan qualifying activity for programs expiring within 90 days.</div>
        </div>
      </div>

      <!-- All-safe banner -->
      <div class="alert-banner safe" *ngIf="visibleStatuses().length > 0 && visibleCriticalCount() === 0 && visibleWarningCount() === 0 && !visibleHasWarnings()" aria-live="polite">
        <span class="alert-icon">✅</span>
        <div>
          <div class="alert-title">{{ showHeldOnly() ? 'My programs are in good shape' : 'All programs are in good shape' }}</div>
          <div class="alert-sub">No points expiring soon. Keep earning!</div>
        </div>
      </div>

      <div class="hidden-alert-note" *ngIf="showHeldOnly() && hiddenUrgentCount() > 0" aria-live="polite">
        {{ hiddenUrgentCount() }} hidden program{{ hiddenUrgentCount() > 1 ? 's' : '' }} outside Mine still need expiry review.
      </div>

      <!-- Activity stats bar -->
      <div class="activity-stats" *ngIf="activityStats() as st">
        <div class="as-item">
          <span class="as-val">{{ st.total }}</span>
          <span class="as-key">programs</span>
        </div>
        <div class="as-sep">·</div>
        <div class="as-item">
          <span class="as-val">{{ st.tracked }}</span>
          <span class="as-key">with dates</span>
        </div>
        <div class="as-sep">·</div>
        <div class="as-item">
          <span class="as-val" [class.warn]="st.coveragePct < 50" [class.good]="st.coveragePct >= 80">
            {{ st.coveragePct }}%
          </span>
          <span class="as-key">tracked</span>
        </div>
        <div class="as-sep" *ngIf="st.avgWindowMonths">·</div>
        <div class="as-item" *ngIf="st.avgWindowMonths">
          <span class="as-val">~{{ st.avgWindowMonths }}mo</span>
          <span class="as-key">avg window</span>
        </div>
      </div>

      <!-- Status cards -->
      <div class="expiry-list">
        <div
          class="expiry-card"
          *ngFor="let status of visibleStatuses()"
          [class.never]="status.urgency === 'never'"
          [class.safe]="status.urgency === 'safe'"
          [class.warning]="status.urgency === 'warning'"
          [class.critical]="status.urgency === 'critical'"
          [class.expired]="status.urgency === 'expired'"
        >
          <div class="ec-header">
            <div class="ec-left">
              <div class="ec-program">{{ status.programName }}</div>
              <div class="ec-urgency-label">
                <span class="urgency-dot" [class]="status.urgency"></span>
                {{ urgencyLabel(status) }}
              </div>
            </div>
            <div class="ec-days" *ngIf="status.daysRemaining !== null">
              <span class="days-val" [class]="status.urgency">{{ status.daysRemaining }}</span>
              <span class="days-label">days left</span>
            </div>
            <div class="ec-days never-icon" *ngIf="status.urgency === 'never'">
              <span>∞</span>
            </div>
          </div>

          <!-- Urgency progress bar -->
          <div class="ec-urgency-bar" *ngIf="status.urgency !== 'never'">
            <div class="ec-ub-fill"
              [class]="status.urgency"
              [style.width]="urgencyBarPct(status) + '%'">
            </div>
          </div>

          <div class="ec-action">{{ status.actionNeeded }}</div>

          <div class="ec-note" *ngIf="status.urgency !== 'never'">{{ status.note }}</div>

          <!-- Quick actions for warning/critical/expired cards -->
          <div class="quick-actions" *ngIf="status.quickActions.length > 0 && (status.urgency === 'warning' || status.urgency === 'critical' || status.urgency === 'expired')">
            <div class="qa-label">Easy ways to reset the clock:</div>
            <ul class="qa-list">
              <li *ngFor="let qa of status.quickActions">{{ qa }}</li>
            </ul>
            <div class="qa-links" *ngIf="getPortalLinks(status.cardId).length > 0">
              <a *ngFor="let link of getPortalLinks(status.cardId)"
                class="qa-link" [href]="link.url" target="_blank" rel="noopener noreferrer">
                🔗 {{ link.label }} →
              </a>
            </div>
          </div>

          <!-- Date setter for activity-based programs -->
          <div class="date-setter" *ngIf="status.urgency !== 'never'">
            <div class="date-setter-top">
              <label class="field-label">Last activity date</label>
              <button type="button" class="today-btn" (click)="markToday(status.cardId)">✓ Mark Today</button>
            </div>
            <div class="date-row">
              <input
                type="date"
                class="date-input"
                [attr.aria-label]="'Last activity date for ' + status.programName"
                [value]="getActivityDate(status.cardId)"
                (change)="onDateChange(status.cardId, $event)"
                [max]="todayStr"
              >
              <button type="button" class="clear-btn" *ngIf="getActivityDate(status.cardId)"
                (click)="expiry.clearActivity(status.cardId)">
                Clear
              </button>
            </div>
            <div class="expiry-date-row">
              <span class="expiry-date-label" *ngIf="status.expiryDate">
                Expires {{ status.expiryDate | date:'MMM d, yyyy' }}
              </span>
              <span class="last-activity-label" *ngIf="getActivityDate(status.cardId)">
                {{ daysSince(status.cardId) }} days ago
              </span>
            </div>
          </div>

        </div>
      </div>

      <div class="filtered-empty" *ngIf="visibleStatuses().length === 0">
        <div class="filtered-empty-icon">☆</div>
        <div class="filtered-empty-title">No saved programs match</div>
        <p>Save programs in Wallet or turn off Mine to review every program.</p>
        <button class="filtered-empty-action" type="button" (click)="setHeldOnly(false)">
          Show all programs
        </button>
      </div>

      <!-- Calendar export -->
      <div class="calendar-export">
        <button type="button" class="cal-btn" (click)="exportCalendar()" [disabled]="calExportCount() === 0">
          📅 Export reminders to calendar
          <span class="cal-count" *ngIf="calExportCount() > 0">({{ calExportCount() }} events)</span>
        </button>
        <p class="cal-note">Generates a .ics file with reminders 30 days before each program's computed expiry date. Import into Google Calendar, Apple Calendar, or Outlook.</p>
      </div>

      <div class="expiry-footer">
        <p>Expiry rules are sourced from each program's terms. Rules can change — verify directly with the program before points expire.</p>
      </div>

      </ng-container>
    </div>
  `,
  styles: [`
    .pill-row {
      display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .pill-row .sync-pill { margin-bottom: 0; }
    .sync-retry {
      margin-left: auto; background: none; border: 1px solid currentColor;
      border-radius: 5px; font-family: 'Geist', sans-serif; font-size: 10px;
      font-weight: 500; color: inherit; padding: 2px 8px; cursor: pointer;
      opacity: 0.7; transition: opacity 0.15s; flex-shrink: 0;
    }
    .sync-retry:hover { opacity: 1; }

    .bulk-today-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.1em; min-height: 44px; padding: 8px 12px; cursor: pointer;
      transition: all 0.15s;
    }
    .bulk-today-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .bulk-today-btn:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    .bulk-today-btn.confirm {
      border-color: var(--tally-amber);
      color: var(--tally-amber);
      background: var(--tally-amber-light);
    }
    .bulk-today-btn.done { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }
    .filter-held-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.1em; min-height: 44px; padding: 8px 12px; cursor: pointer; transition: all 0.15s;
    }
    .filter-held-btn.active { border-color: var(--tally-amber, #d97706); color: var(--tally-amber, #d97706); background: rgba(217,119,6,0.07); }

    .shimmer-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
    .shimmer-card { height: 100px; }

    .alert-banner {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 16px; border-radius: 12px; margin-bottom: 20px;
    }
    .alert-banner.critical { background: var(--tally-red-light); border: 1px solid rgba(220,38,38,0.2); }
    .alert-banner.warning { background: rgba(251,191,36,0.1); border: 1px solid rgba(217,119,6,0.2); }
    .alert-banner.warning .alert-title { color: var(--tally-amber, #d97706); }
    .alert-banner.warning .alert-sub { color: var(--tally-amber, #d97706); }
    .alert-banner.safe { background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2); }
    .alert-banner.safe .alert-title { color: var(--tally-green); }
    .alert-banner.safe .alert-sub { color: var(--tally-green-mid); }
    .alert-icon { font-size: 20px; flex-shrink: 0; }
    .alert-title { font-size: 14px; font-weight: 600; color: var(--tally-red); margin-bottom: 2px; }
    .alert-sub { font-size: 12px; color: var(--tally-red); opacity: 0.8; }
    .hidden-alert-note {
      margin: -10px 0 14px; padding: 9px 12px;
      border: 1px solid rgba(217,119,6,0.2); border-radius: 10px;
      background: rgba(217,119,6,0.07); color: var(--tally-amber);
      font-family: 'Geist Mono', monospace; font-size: 10px; line-height: 1.45;
    }

    .expiry-list { display: flex; flex-direction: column; gap: 10px; }
    .filtered-empty {
      text-align: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px 18px;
      margin: 10px 0 16px;
    }
    .filtered-empty-icon {
      font-size: 24px;
      color: var(--tally-amber);
      margin-bottom: 8px;
    }
    .filtered-empty-title {
      font-family: 'Instrument Serif', serif;
      font-size: 22px;
      color: var(--text);
      margin-bottom: 4px;
    }
    .filtered-empty p {
      font-size: 12px;
      color: var(--text3);
      line-height: 1.5;
    }
    .filtered-empty-action {
      margin-top: 12px;
      background: var(--white);
      border: 1px solid var(--border2);
      border-radius: 9px;
      color: var(--tally-green);
      cursor: pointer;
      font-family: 'Geist Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.08em;
      padding: 10px 14px;
      min-height: 44px;
    }

    .expiry-card {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 14px; padding: 16px; border-left: 3px solid var(--border2);
      animation: fadeUp 0.3s ease both;
    }
    @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

    .expiry-card.never  { border-left-color: var(--border2); }
    .expiry-card.safe   { border-left-color: var(--tally-green); }
    .expiry-card.warning { border-left-color: var(--tally-amber); }
    .expiry-card.critical { border-left-color: var(--tally-red); background: var(--tally-red-light); }
    .expiry-card.expired  { border-left-color: var(--tally-red); background: var(--tally-red-light); opacity: 0.9; }

    .ec-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
    .ec-left { flex: 1; min-width: 0; }
    .ec-program {
      font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 4px;
      overflow-wrap: anywhere;
    }
    .ec-urgency-label {
      display: flex; align-items: center; gap: 6px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--text3);
      line-height: 1.35;
    }
    .urgency-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }
    .urgency-dot.never    { background: var(--border2); }
    .urgency-dot.safe     { background: var(--tally-green); }
    .urgency-dot.warning  { background: var(--tally-amber); }
    .urgency-dot.critical { background: var(--tally-red); }
    .urgency-dot.expired  { background: var(--tally-red); }

    .ec-days { text-align: right; flex-shrink: 0; }
    .days-val {
      font-family: 'Geist Mono', monospace; font-size: 24px;
      display: block; line-height: 1;
    }
    .days-val.safe     { color: var(--tally-green); }
    .days-val.warning  { color: var(--tally-amber); }
    .days-val.critical { color: var(--tally-red); }
    .days-val.expired  { color: var(--tally-red); }
    .days-label { font-family: 'Geist Mono', monospace; font-size: 9px; color: var(--text3); letter-spacing: 0.1em; }

    .never-icon { font-size: 24px; color: var(--text3); line-height: 1; }

    .ec-urgency-bar {
      height: 3px; background: var(--border); border-radius: 99px;
      overflow: hidden; margin-bottom: 12px;
    }
    .ec-ub-fill {
      height: 100%; border-radius: 99px;
      transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1);
    }
    .ec-ub-fill.safe     { background: var(--tally-green); }
    .ec-ub-fill.warning  { background: var(--tally-amber, #d97706); }
    .ec-ub-fill.critical { background: var(--tally-red); animation: pulse-bar 1.5s ease-in-out infinite; }
    .ec-ub-fill.expired  { background: var(--tally-red); }
    @keyframes pulse-bar { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

    .ec-action { font-size: 13px; color: var(--text2); line-height: 1.5; margin-bottom: 8px; }
    .ec-note { font-size: 11px; color: var(--text3); line-height: 1.5; font-style: italic; margin-bottom: 12px; }

    /* Quick action suggestions */
    .quick-actions {
      background: var(--surface); border-radius: 9px;
      padding: 10px 12px; margin-bottom: 12px;
    }
    .qa-label {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--text3); margin-bottom: 6px;
    }
    .qa-list {
      margin: 0; padding-left: 14px; display: flex; flex-direction: column; gap: 3px;
    }
    .qa-list li { font-size: 12px; color: var(--text2); line-height: 1.4; }
    .qa-links { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
    .qa-link {
      display: inline-flex; align-items: center;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.04em; color: var(--tally-green);
      text-decoration: none; min-height: 44px; padding: 8px 0;
      transition: opacity 0.15s;
      max-width: 100%; overflow-wrap: anywhere; white-space: normal;
    }
    .qa-link:hover { opacity: 0.75; text-decoration: underline; }

    .date-setter { border-top: 1px solid var(--border); padding-top: 12px; }
    .date-setter-top {
      display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px;
      flex-wrap: wrap;
    }
    .field-label {
      font-family: 'Geist Mono', monospace;
      font-size: 9px; letter-spacing: 0.15em; color: var(--text3);
      text-transform: uppercase; display: block; min-width: 0; overflow-wrap: anywhere;
    }
    .today-btn {
      background: var(--tally-green); border: none; border-radius: 7px;
      color: white; font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.08em; min-height: 44px; padding: 8px 12px; cursor: pointer;
      transition: opacity 0.15s; flex: 0 0 auto;
    }
    .today-btn:hover { opacity: 0.85; }
    .date-row { display: flex; gap: 8px; align-items: center; }
    .date-input {
      background: var(--surface); border: 1.5px solid var(--border2);
      border-radius: 9px; color: var(--text);
      font-family: 'Geist', sans-serif; font-size: 13px;
      min-height: 44px; padding: 10px 12px; outline: none; flex: 1;
      min-width: 0;
      transition: border-color 0.15s;
    }
    .date-input:focus { border-color: var(--tally-green); }
    .clear-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist', sans-serif; font-size: 12px;
      min-height: 44px; padding: 10px 12px; cursor: pointer; white-space: nowrap;
      transition: all 0.15s; flex: 0 0 auto;
    }
    .clear-btn:hover { border-color: var(--tally-red); color: var(--tally-red); }

    .expiry-date-row {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 6px; flex-wrap: wrap; gap: 4px;
    }
    .expiry-date-label {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); letter-spacing: 0.06em;
    }
    .last-activity-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--border2); letter-spacing: 0.04em;
    }

    /* Calendar export */
    .calendar-export { padding: 16px 0 8px; }
    .cal-btn {
      width: 100%; background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; min-height: 48px; padding: 12px 16px;
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 500;
      color: var(--text2); cursor: pointer; text-align: left;
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      transition: border-color 0.15s; margin-bottom: 6px;
    }
    .cal-btn:hover:not(:disabled) { border-color: var(--tally-green); color: var(--tally-green); }
    .cal-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .cal-count {
      font-family: 'Geist Mono', monospace; font-size: 10px; color: var(--text3); margin-left: 4px;
    }
    .cal-note {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); line-height: 1.5; letter-spacing: 0.04em;
    }

    .expiry-footer {
      margin-top: 20px; padding: 14px 16px;
      background: var(--surface); border-radius: 10px;
      border: 1px solid var(--border);
    }
    .expiry-footer p { font-size: 11px; color: var(--text3); line-height: 1.6; }

    /* Activity stats bar */
    .activity-stats {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 10px 14px; margin-bottom: 16px;
    }
    .as-item { display: flex; flex-direction: column; align-items: center; gap: 1px; }
    .as-sep { font-family: 'Geist Mono', monospace; font-size: 10px; color: var(--border2); }
    .as-val {
      font-family: 'Geist Mono', monospace; font-size: 16px;
      color: var(--text); font-weight: 600; line-height: 1;
    }
    .as-val.warn { color: var(--tally-amber, #d97706); }
    .as-val.good { color: var(--tally-green); }
    .as-key {
      font-family: 'Geist Mono', monospace; font-size: 7px;
      letter-spacing: 0.12em; text-transform: uppercase; color: var(--text3);
    }
    @media (min-width: 760px) {
      .bulk-today-btn { margin-left: auto; }
      .date-input { min-width: 12rem; }
      .expiry-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        align-items: start;
      }
      .activity-stats {
        justify-content: flex-start;
      }
    }
    @media (max-width: 520px) {
      .pill-row > * { flex: 1 1 auto; }
      .pill-row .sync-pill { flex-basis: 100%; }
      .bulk-today-btn,
      .filter-held-btn {
        flex: 1 1 calc(50% - 5px);
        min-width: 0;
        white-space: normal;
      }
      .ec-header { align-items: flex-start; }
      .date-setter-top { align-items: flex-start; flex-direction: column; gap: 8px; }
      .today-btn { width: 100%; }
      .date-row { flex-direction: column; align-items: stretch; }
      .clear-btn { width: 100%; }
      .activity-stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: stretch;
        gap: 10px;
      }
      .as-item {
        min-width: 0;
        padding: 8px 6px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--white);
      }
      .as-sep { display: none; }
    }
    @media (max-width: 360px) {
      .ec-header { flex-direction: column; }
      .ec-days { text-align: left; }
    }
    @media (max-width: 400px) {
      .bulk-today-btn.confirm {
        flex-basis: 100%;
      }
      .bulk-today-btn,
      .filter-held-btn {
        white-space: normal;
      }
    }
  `]
})
export class ExpiryComponent implements OnDestroy {
  expiry = inject(ExpiryService);
  wallet = inject(WalletService);
  prefs = inject(PreferencesService);
  todayStr = this.formatLocalDate(new Date());
  bulkDone = signal(false);
  bulkConfirm = signal(false);
  showHeldOnly = signal(this.loadShowHeldOnly());
  private bulkConfirmTimer: ReturnType<typeof setTimeout> | null = null;
  private bulkDoneTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.saveShowHeldOnly(this.showHeldOnly());
    });
  }

  readonly visibleStatuses = computed(() => {
    const statuses = this.expiry.statuses();
    if (!this.showHeldOnly()) return statuses;
    return statuses.filter(s => this.isHeldProgram(s.cardId));
  });

  readonly visibleCriticalCount = computed(() =>
    this.visibleStatuses().filter(status => status.urgency === 'critical' || status.urgency === 'expired').length
  );

  readonly visibleWarningCount = computed(() =>
    this.visibleStatuses().filter(status => status.urgency === 'warning').length
  );

  readonly visibleHasWarnings = computed(() =>
    this.visibleStatuses().some(status => status.urgency === 'warning' || status.urgency === 'critical' || status.urgency === 'expired')
  );

  readonly hiddenUrgentCount = computed(() => {
    if (!this.showHeldOnly()) return 0;
    return this.expiry.statuses().filter(status =>
      !this.isHeldProgram(status.cardId) &&
      (status.urgency === 'warning' || status.urgency === 'critical' || status.urgency === 'expired')
    ).length;
  });

  readonly bulkMarkableStatuses = computed(() =>
    this.visibleStatuses().filter(status => status.urgency !== 'never' && !this.expiry.records()[status.cardId]?.lastActivityDate)
  );

  readonly bulkMarkableCount = computed(() =>
    this.bulkMarkableStatuses().length
  );

  readonly heldProgramIdSet = computed(() => new Set(this.prefs.preferences().heldProgramIds ?? []));

  ngOnDestroy(): void {
    if (this.bulkConfirmTimer) clearTimeout(this.bulkConfirmTimer);
    if (this.bulkDoneTimer) clearTimeout(this.bulkDoneTimer);
  }

  syncLabel(state: SyncState): string {
    const pending = this.expiry.pendingCount();
    if (pending > 0) return `${pending} change${pending === 1 ? '' : 's'} pending`;
    switch (state) {
      case 'idle':    return 'Local';
      case 'loading': return 'Syncing…';
      case 'synced':  return 'Synced';
      case 'error':   return 'Offline — local only';
    }
  }

  urgencyLabel(status: ExpiryStatus): string {
    switch (status.urgency) {
      case 'never':    return 'Never expires';
      case 'safe':     return 'Safe';
      case 'warning':  return 'Expiring soon';
      case 'critical': return 'Urgent — act now';
      case 'expired':  return 'Possibly expired';
    }
  }

  getActivityDate(cardId: string): string {
    return this.expiry.records()[cardId]?.lastActivityDate ?? '';
  }

  onDateChange(cardId: string, event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) {
      this.expiry.setLastActivity(cardId, val);
    } else {
      this.expiry.clearActivity(cardId);
    }
  }

  /** Returns 0–100 for the urgency bar fill based on days remaining */
  urgencyBarPct(status: ExpiryStatus): number {
    if (status.urgency === 'expired') return 100;
    if (status.daysRemaining === null) return 0;
    const d = status.daysRemaining;
    if (d <= 30)  return Math.round((d / 30) * 100);
    if (d <= 90)  return Math.round((d / 90) * 100);
    return 100; // safe
  }

  markToday(cardId: string): void {
    this.expiry.setLastActivity(cardId, this.todayStr);
  }

  markAllToday(): void {
    if (this.bulkMarkableCount() === 0) return;

    if (!this.bulkConfirm()) {
      this.bulkConfirm.set(true);
      if (this.bulkConfirmTimer) clearTimeout(this.bulkConfirmTimer);
      this.bulkConfirmTimer = setTimeout(() => this.bulkConfirm.set(false), 3000);
      return;
    }

    if (this.bulkConfirmTimer) clearTimeout(this.bulkConfirmTimer);
    this.bulkConfirmTimer = null;
    this.bulkConfirm.set(false);

    // Fill only missing dates; existing activity dates are intentional user data.
    for (const status of this.bulkMarkableStatuses()) {
      this.expiry.setLastActivity(status.cardId, this.todayStr);
    }
    this.bulkDone.set(true);
    if (this.bulkDoneTimer) clearTimeout(this.bulkDoneTimer);
    this.bulkDoneTimer = setTimeout(() => this.bulkDone.set(false), 3000);
  }

  toggleHeldOnly(): void {
    this.setHeldOnly(!this.showHeldOnly());
  }

  setHeldOnly(value: boolean): void {
    this.showHeldOnly.set(value);
  }

  hasAnyHeldPrograms(): boolean {
    return this.wallet.hasAnyPoints() || this.heldProgramIdSet().size > 0;
  }

  isHeldProgram(cardId: string): boolean {
    return this.heldProgramIdSet().has(cardId) || this.wallet.getBalance(cardId) > 0;
  }

  private loadShowHeldOnly(): boolean {
    try {
      return sessionStorage.getItem(EXPIRY_UI_STATE_KEY) === 'mine';
    } catch {
      return false;
    }
  }

  private saveShowHeldOnly(value: boolean): void {
    try {
      if (value) {
        sessionStorage.setItem(EXPIRY_UI_STATE_KEY, 'mine');
      } else {
        sessionStorage.removeItem(EXPIRY_UI_STATE_KEY);
      }
    } catch {
      // Ignore storage errors: the filter still works for the current component instance.
    }
  }

  bulkButtonLabel(): string {
    if (this.bulkMarkableCount() === 0) return 'Nothing to update';
    if (this.bulkDone()) return '✓ All updated';
    if (this.bulkConfirm()) return 'Tap again to confirm';
    return this.showHeldOnly() ? 'Mark mine today' : 'Mark all today';
  }

  alertScopeLabel(): string {
    return this.showHeldOnly() ? 'My ' : '';
  }

  bulkButtonAriaLabel(): string {
    if (this.bulkMarkableCount() === 0) return 'All visible expirable programs already have activity dates';
    if (this.bulkDone()) return 'All visible expirable programs marked with today as last activity';
    if (this.bulkConfirm()) return 'Confirm marking visible expirable programs with today as last activity';
    return this.showHeldOnly()
      ? 'Mark my visible expirable programs with today as last activity'
      : 'Mark all visible expirable programs with today as last activity';
  }

  /** Number of days elapsed since the last recorded activity date */
  daysSince(cardId: string): number {
    const dateStr = this.getActivityDate(cardId);
    if (!dateStr) return 0;
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const activity = new Date(y, m - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.max(0, Math.round((today.getTime() - activity.getTime()) / (1000 * 60 * 60 * 24)));
    } catch { return 0; }
  }

  getPortalLinks(cardId: string): Array<{ label: string; url: string }> {
    return PORTAL_LINKS[cardId] ?? [];
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Count of statuses that have a computed expiry date (for calendar export button) */
  readonly calExportCount = computed(() =>
    this.visibleStatuses().filter(s => s.expiryDate !== null && s.urgency !== 'never').length
  );

  /** Summary stats for the activity stats bar */
  readonly activityStats = computed((): {
    total: number; tracked: number; coveragePct: number; avgWindowMonths: number | null;
  } | null => {
    const statuses = this.visibleStatuses();
    const records = this.expiry.records();
    // Only count programs that actually expire (not 'never')
    const expirable = statuses.filter(s => s.urgency !== 'never');
    if (expirable.length === 0) return null;
    const tracked = expirable.filter(s => s.daysRemaining !== null).length;
    const coveragePct = Math.round((tracked / expirable.length) * 100);

    // Infer average inactivity window from (expiryDate − lastActivityDate) for programs with dates
    const windows: number[] = [];
    for (const s of expirable) {
      if (!s.expiryDate) continue;
      const record = records[s.cardId];
      if (!record) continue;
      const [y, m, d] = record.lastActivityDate.split('-').map(Number);
      const actDate = new Date(y, m - 1, d);
      const months = (s.expiryDate.getFullYear() - actDate.getFullYear()) * 12
        + (s.expiryDate.getMonth() - actDate.getMonth());
      if (months > 0 && months <= 36) windows.push(months);
    }
    const avgWindowMonths = windows.length > 0
      ? Math.round(windows.reduce((a, b) => a + b, 0) / windows.length)
      : null;

    return { total: expirable.length, tracked, coveragePct, avgWindowMonths };
  });

  exportCalendar(): void {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tally Points//Expiry Tracker//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    for (const s of this.visibleStatuses()) {
      if (!s.expiryDate || s.urgency === 'never') continue;

      // 30-day warning event
      const reminderDate = new Date(s.expiryDate);
      reminderDate.setDate(reminderDate.getDate() - 30);
      const dtStart = this.icsDate(reminderDate);
      const dtStartEnd = this.icsDate(this.addDays(reminderDate, 1));

      // Expiry event
      const dtExpiry = this.icsDate(s.expiryDate);
      const dtExpiryEnd = this.icsDate(this.addDays(s.expiryDate, 1));
      const programName = this.escapeIcsText(s.programName);
      const note = this.escapeIcsText(s.note);
      const quickActions = this.escapeIcsText(s.quickActions.map(a => `- ${a}`).join('\n'));

      // 30-day reminder
      lines.push(
        'BEGIN:VEVENT',
        `UID:tally-remind-${s.cardId}-${now}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtStartEnd}`,
        `SUMMARY:${programName} - 30 days to expiry`,
        `DESCRIPTION:${this.escapeIcsText(`Your ${s.programName} points will expire on ${s.expiryDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} if you do not take action.`)}\\n\\n${note}\\n\\nEasy ways to reset:\\n${quickActions}`,
        'END:VEVENT',
      );

      // Expiry day event
      lines.push(
        'BEGIN:VEVENT',
        `UID:tally-expire-${s.cardId}-${now}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dtExpiry}`,
        `DTEND;VALUE=DATE:${dtExpiryEnd}`,
        `SUMMARY:${programName} points expire TODAY`,
        `DESCRIPTION:${this.escapeIcsText(`${s.programName} points are expiring today. Act immediately or points may be lost.`)}`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');

    const ics = lines.join('\r\n');
    this.downloadBlob(
      new Blob([ics], { type: 'text/calendar;charset=utf-8' }),
      `tally-expiry-reminders-${this.todayStr}.ics`,
    );
  }

  private icsDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private escapeIcsText(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/\r?\n/g, '\\n')
      .replace(/,/g, '\\,')
      .replace(/;/g, '\\;');
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
}

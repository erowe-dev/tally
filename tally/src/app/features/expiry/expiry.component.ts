import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpiryService, ExpiryStatus, SyncState } from '../../core/services/expiry.service';
import { WalletService } from '../../core/services/wallet.service';

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
        <div class="sync-pill" [class]="expiry.syncState()">
          <span class="sync-dot"></span>
          <span class="sync-text">{{ syncLabel(expiry.syncState()) }}</span>
        </div>
        <button class="bulk-today-btn"
          *ngIf="expiry.syncState() !== 'loading'"
          (click)="markAllToday()"
          [class.done]="bulkDone()">
          {{ bulkDone() ? '✓ All updated' : 'Mark all today' }}
        </button>
        <button class="filter-held-btn" *ngIf="wallet.hasAnyPoints()"
          [class.active]="showHeldOnly()"
          (click)="showHeldOnly.set(!showHeldOnly())">
          {{ showHeldOnly() ? '★ Mine' : '☆ Mine' }}
        </button>
      </div>

      <!-- Loading shimmer -->
      <div *ngIf="expiry.syncState() === 'loading'" class="shimmer-list">
        <div class="shimmer-card" *ngFor="let n of [1,2,3]"></div>
      </div>

      <ng-container *ngIf="expiry.syncState() !== 'loading'">

      <!-- Critical alert banner -->
      <div class="alert-banner critical" *ngIf="expiry.criticalCount() > 0">
        <span class="alert-icon">⚠️</span>
        <div>
          <div class="alert-title">{{ expiry.criticalCount() }} program{{ expiry.criticalCount() > 1 ? 's' : '' }} need immediate attention</div>
          <div class="alert-sub">Points may expire within 30 days. Act now.</div>
        </div>
      </div>

      <!-- Warning banner (when no critical but have warnings) -->
      <div class="alert-banner warning" *ngIf="expiry.criticalCount() === 0 && expiry.warningCount() > 0">
        <span class="alert-icon">🔔</span>
        <div>
          <div class="alert-title">{{ expiry.warningCount() }} program{{ expiry.warningCount() > 1 ? 's' : '' }} expiring in 60–90 days</div>
          <div class="alert-sub">Plan your next qualifying activity soon.</div>
        </div>
      </div>

      <!-- All-safe banner -->
      <div class="alert-banner safe" *ngIf="expiry.criticalCount() === 0 && expiry.warningCount() === 0 && !expiry.hasWarnings()">
        <span class="alert-icon">✅</span>
        <div>
          <div class="alert-title">All programs are in good shape</div>
          <div class="alert-sub">No points expiring soon. Keep earning!</div>
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
          </div>

          <!-- Date setter for activity-based programs -->
          <div class="date-setter" *ngIf="status.urgency !== 'never'">
            <div class="date-setter-top">
              <label class="field-label">Last activity date</label>
              <button class="today-btn" (click)="markToday(status.cardId)">✓ Mark Today</button>
            </div>
            <div class="date-row">
              <input
                type="date"
                class="date-input"
                [value]="getActivityDate(status.cardId)"
                (change)="onDateChange(status.cardId, $event)"
                [max]="todayStr"
              >
              <button class="clear-btn" *ngIf="getActivityDate(status.cardId)"
                (click)="expiry.clearActivity(status.cardId)">
                Clear
              </button>
            </div>
            <div class="expiry-date-label" *ngIf="status.expiryDate">
              Expires {{ status.expiryDate | date:'MMM d, yyyy' }}
            </div>
          </div>

        </div>
      </div>

      <!-- Calendar export -->
      <div class="calendar-export">
        <button class="cal-btn" (click)="exportCalendar()" [disabled]="calExportCount() === 0">
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

    .bulk-today-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.1em; padding: 4px 12px; cursor: pointer;
      transition: all 0.15s;
    }
    .bulk-today-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .bulk-today-btn.done { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }
    .filter-held-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.1em; padding: 4px 12px; cursor: pointer; transition: all 0.15s;
    }
    .filter-held-btn.active { border-color: var(--tally-amber, #d97706); color: var(--tally-amber, #d97706); background: rgba(217,119,6,0.07); }

    /* Sync status pill */
    .sync-pill {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.08em; text-transform: uppercase;
      padding: 4px 10px; border-radius: 20px;
      border: 1px solid var(--border);
      color: var(--text3); background: var(--surface);
      transition: all 0.3s;
    }
    .sync-pill.synced { border-color: rgba(26,122,74,0.3); color: var(--tally-green); background: var(--tally-green-light); }
    .sync-pill.error  { border-color: rgba(220,38,38,0.3); color: var(--tally-red); background: var(--tally-red-light); }
    .sync-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
    .sync-pill.loading .sync-dot { animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

    /* Shimmer loading */
    .shimmer-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
    .shimmer-card {
      height: 100px; border-radius: 14px;
      background: linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

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

    .expiry-list { display: flex; flex-direction: column; gap: 10px; }

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
    .ec-left { flex: 1; }
    .ec-program { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
    .ec-urgency-label {
      display: flex; align-items: center; gap: 6px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--text3);
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

    .date-setter { border-top: 1px solid var(--border); padding-top: 12px; }
    .date-setter-top {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;
    }
    .field-label {
      font-family: 'Geist Mono', monospace;
      font-size: 9px; letter-spacing: 0.15em; color: var(--text3);
      text-transform: uppercase; display: block;
    }
    .today-btn {
      background: var(--tally-green); border: none; border-radius: 7px;
      color: white; font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.08em; padding: 4px 10px; cursor: pointer;
      transition: opacity 0.15s;
    }
    .today-btn:hover { opacity: 0.85; }
    .date-row { display: flex; gap: 8px; align-items: center; }
    .date-input {
      background: var(--surface); border: 1.5px solid var(--border2);
      border-radius: 9px; color: var(--text);
      font-family: 'Geist', sans-serif; font-size: 13px;
      padding: 8px 12px; outline: none; flex: 1;
      transition: border-color 0.15s;
    }
    .date-input:focus { border-color: var(--tally-green); }
    .clear-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist', sans-serif; font-size: 12px;
      padding: 8px 12px; cursor: pointer; white-space: nowrap;
      transition: all 0.15s;
    }
    .clear-btn:hover { border-color: var(--tally-red); color: var(--tally-red); }

    .expiry-date-label {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); letter-spacing: 0.06em; margin-top: 6px;
    }

    /* Calendar export */
    .calendar-export { padding: 16px 0 8px; }
    .cal-btn {
      width: 100%; background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 12px 16px;
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 500;
      color: var(--text2); cursor: pointer; text-align: left;
      display: flex; align-items: center; gap: 6px;
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
  `]
})
export class ExpiryComponent {
  expiry = inject(ExpiryService);
  wallet = inject(WalletService);
  todayStr = this.formatLocalDate(new Date());
  bulkDone = signal(false);
  showHeldOnly = signal(false);

  readonly visibleStatuses = computed(() => {
    const statuses = this.expiry.statuses();
    if (!this.showHeldOnly()) return statuses;
    return statuses.filter(s => this.wallet.getBalance(s.cardId) > 0);
  });

  syncLabel(state: SyncState): string {
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
    if (val) this.expiry.setLastActivity(cardId, val);
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
    // Mark all non-never programs as active today
    for (const status of this.expiry.statuses()) {
      if (status.urgency !== 'never') {
        this.expiry.setLastActivity(status.cardId, this.todayStr);
      }
    }
    this.bulkDone.set(true);
    setTimeout(() => this.bulkDone.set(false), 3000);
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Count of statuses that have a computed expiry date (for calendar export button) */
  readonly calExportCount = computed(() =>
    this.expiry.statuses().filter(s => s.expiryDate !== null && s.urgency !== 'never').length
  );

  exportCalendar(): void {
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tally Points//Expiry Tracker//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    for (const s of this.expiry.statuses()) {
      if (!s.expiryDate || s.urgency === 'never') continue;

      // 30-day warning event
      const reminderDate = new Date(s.expiryDate);
      reminderDate.setDate(reminderDate.getDate() - 30);
      const dtStart = this.icsDate(reminderDate);

      // Expiry event
      const dtExpiry = this.icsDate(s.expiryDate);

      // 30-day reminder
      lines.push(
        'BEGIN:VEVENT',
        `UID:tally-remind-${s.cardId}-${now}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtStart}`,
        `SUMMARY:⏱ ${s.programName} — 30 days to expiry`,
        `DESCRIPTION:Your ${s.programName} points will expire on ${s.expiryDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} if you don't take action.\\n\\n${s.note}\\n\\nEasy ways to reset:\\n${s.quickActions.map(a => '• ' + a).join('\\n')}`,
        'END:VEVENT',
      );

      // Expiry day event
      lines.push(
        'BEGIN:VEVENT',
        `UID:tally-expire-${s.cardId}-${now}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dtExpiry}`,
        `DTEND;VALUE=DATE:${dtExpiry}`,
        `SUMMARY:🔴 ${s.programName} points expire TODAY`,
        `DESCRIPTION:${s.programName} points are expiring today. Act immediately or points may be lost.`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');

    const ics = lines.join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tally-expiry-reminders-${this.todayStr}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private icsDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
}

import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';

export interface ExpiryRule {
  cardId: string;
  programName: string;
  expiryType: 'activity' | 'fixed' | 'never';
  /** months of inactivity before expiry (for 'activity' type) */
  inactivityMonths?: number;
  /** fixed expiry in months from earn date (for 'fixed' type) */
  fixedMonths?: number;
  note: string;
  /** Concrete low-effort actions that reset the expiry clock */
  quickActions?: string[];
}

export interface ExpiryRecord {
  cardId: string;
  lastActivityDate: string; // ISO date string YYYY-MM-DD
}

export interface ExpiryStatus {
  cardId: string;
  programName: string;
  daysRemaining: number | null;
  urgency: 'safe' | 'warning' | 'critical' | 'expired' | 'never';
  expiryDate: Date | null;
  note: string;
  actionNeeded: string;
  quickActions: string[];
}

export type SyncState = 'idle' | 'loading' | 'synced' | 'error';

const STORAGE_KEY = 'tally_expiry_v1';
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a YYYY-MM-DD string both syntactically and semantically.
 * Rejects '2026-13-99' that passes the regex but overflows to a wrong date.
 */
function isValidDateString(value: string): boolean {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

const EXPIRY_RULES: ExpiryRule[] = [
  // ── Transferable currencies ────────────────────────────────────────────────
  {
    cardId: 'amex_mr',
    programName: 'Amex Membership Rewards',
    expiryType: 'activity',
    inactivityMonths: 0,
    note: 'Points expire only when you close all earning MR cards.',
  },
  {
    cardId: 'chase_ur',
    programName: 'Chase Ultimate Rewards',
    expiryType: 'activity',
    inactivityMonths: 0,
    note: 'Points expire only if you close your earning UR card with no transfer card open.',
  },
  {
    cardId: 'citi_ty',
    programName: 'Citi ThankYou Points',
    expiryType: 'activity',
    inactivityMonths: 18,
    note: 'Points expire after 18 months of account inactivity. A single purchase resets the clock.',
    quickActions: [
      'Make any purchase on your Citi card',
      'Transfer points to a travel partner',
      'Redeem points for a gift card or statement credit',
    ],
  },
  {
    cardId: 'cap1_miles',
    programName: 'Capital One Miles',
    expiryType: 'never',
    note: 'Capital One miles do not expire as long as the account is open.',
  },
  {
    cardId: 'bilt',
    programName: 'Bilt Rewards',
    expiryType: 'activity',
    inactivityMonths: 24,
    note: 'Points expire after 24 months of inactivity. Pay rent each month to keep them active.',
    quickActions: [
      'Pay rent via the Bilt app (also earns points)',
      'Make any purchase with your Bilt Mastercard',
      'Transfer points to a travel partner',
    ],
  },

  // ── Airline programs ──────────────────────────────────────────────────────
  {
    cardId: 'delta_skymiles',
    programName: 'Delta SkyMiles',
    expiryType: 'never',
    note: 'Delta SkyMiles never expire. Delta eliminated expiry in 2011.',
  },
  {
    cardId: 'united_mp',
    programName: 'United MileagePlus',
    expiryType: 'activity',
    inactivityMonths: 18,
    note: 'Miles expire after 18 months of account inactivity. Any earning or redemption resets the clock.',
    quickActions: [
      'Make a purchase on the United MileagePlus card',
      'Shop via the MileagePlus Shopping portal',
      'Book a hotel or car rental via United',
    ],
  },
  {
    cardId: 'aa_aadvantage',
    programName: 'American AAdvantage',
    expiryType: 'activity',
    inactivityMonths: 24,
    note: 'Miles expire after 24 months of inactivity. Any flight, purchase, or partner earn resets the clock.',
    quickActions: [
      'Shop via AAdvantage eShopping portal (even $1 works)',
      'Use your AAdvantage credit card for any purchase',
      'Dine with an AAdvantage dining partner',
    ],
  },
  {
    cardId: 'southwest_rr',
    programName: 'Southwest Rapid Rewards',
    expiryType: 'activity',
    inactivityMonths: 24,
    note: 'Points expire after 24 months of inactivity. Any purchase on the Southwest card resets the clock.',
    quickActions: [
      'Make any purchase on the Southwest Rapid Rewards card',
      'Shop via the Southwest Rapid Rewards Shopping portal',
      'Book a hotel or car rental through Southwest',
    ],
  },
  {
    cardId: 'alaska_mp',
    programName: 'Alaska MileagePlan',
    expiryType: 'activity',
    inactivityMonths: 24,
    note: 'Miles expire after 24 months of inactivity. Flying, earning via partners, or shopping portal activity resets the clock.',
    quickActions: [
      'Shop via Alaska Airlines Shopping portal',
      'Dine via Alaska MileagePlan Dining',
      'Book a car rental or hotel via Alaska',
    ],
  },

  // ── Hotel programs ────────────────────────────────────────────────────────
  {
    cardId: 'marriott_bonvoy',
    programName: 'Marriott Bonvoy',
    expiryType: 'activity',
    inactivityMonths: 24,
    note: 'Points expire after 24 months of inactivity. Any stay, purchase, or transfer resets the clock.',
    quickActions: [
      'Stay at any Marriott property (even one night)',
      'Redeem points for an experience or gift card',
      'Transfer Amex MR or Chase UR points into Bonvoy',
    ],
  },
  {
    cardId: 'hyatt',
    programName: 'World of Hyatt',
    expiryType: 'activity',
    inactivityMonths: 24,
    note: 'Points expire after 24 months of inactivity. Any stay or qualifying activity resets the clock.',
    quickActions: [
      'Stay at any Hyatt property',
      'Make a purchase with the World of Hyatt card',
      'Transfer Chase Ultimate Rewards to Hyatt (1:1)',
    ],
  },
  {
    cardId: 'hilton_honors',
    programName: 'Hilton Honors',
    expiryType: 'activity',
    inactivityMonths: 24,
    note: 'Points expire after 24 months of inactivity. A single stay, purchase, or partner activity resets the clock.',
    quickActions: [
      'Stay at any Hilton property',
      'Use your Hilton Honors Amex card for any purchase',
      'Transfer Amex MR points into Hilton Honors',
    ],
  },
  {
    cardId: 'ihg_rewards',
    programName: 'IHG One Rewards',
    expiryType: 'activity',
    inactivityMonths: 12,
    note: 'Points expire after just 12 months of inactivity — shortest window of any major hotel program. Any stay or purchase resets.',
    quickActions: [
      'Stay at any IHG property (Holiday Inn, InterContinental, etc.)',
      'Make a purchase on the IHG One Rewards card',
      'Purchase points directly from IHG ($10 minimum)',
    ],
  },
];

// Programs where expiry is "never" or tied to card-open status (no date needed)
const SAFE_CARDS = new Set(['amex_mr', 'chase_ur', 'cap1_miles', 'delta_skymiles']);

@Injectable({ providedIn: 'root' })
export class ExpiryService {
  private auth = inject(AuthService);
  private api = inject(ApiService);
  private network = inject(NetworkService);

  private _records = signal<Record<string, ExpiryRecord>>(this.loadLocal());
  private _syncState = signal<SyncState>('idle');

  // One-shot guard: prevents the effect from re-running on signal re-evaluation
  private _apiLoaded = false;

  readonly records = this._records.asReadonly();
  readonly syncState = this._syncState.asReadonly();

  private static readonly URGENCY_ORDER: Record<ExpiryStatus['urgency'], number> = {
    expired: 0, critical: 1, warning: 2, safe: 3, never: 4,
  };

  readonly statuses = computed<ExpiryStatus[]>(() => {
    const records = this._records();
    return EXPIRY_RULES
      .map(rule => this.computeStatus(rule, records[rule.cardId]))
      .sort((a, b) => {
        // Primary: urgency tier (expired → critical → warning → safe → never)
        const urgDiff = ExpiryService.URGENCY_ORDER[a.urgency] - ExpiryService.URGENCY_ORDER[b.urgency];
        if (urgDiff !== 0) return urgDiff;
        // Secondary: soonest-expiring first within each tier (nulls/never last)
        const da = a.daysRemaining ?? Infinity;
        const db = b.daysRemaining ?? Infinity;
        return da - db;
      });
  });

  readonly hasWarnings = computed(() =>
    this.statuses().some(
      s => s.urgency === 'warning' || s.urgency === 'critical' || s.urgency === 'expired',
    ),
  );

  readonly warningCount = computed(() =>
    this.statuses().filter(s => s.urgency === 'warning').length,
  );

  readonly criticalCount = computed(() =>
    this.statuses().filter(s => s.urgency === 'critical' || s.urgency === 'expired').length,
  );

  constructor() {
    // Load from API exactly once per session, after user row is confirmed.
    // Gate on isProvisioned() to prevent a 404 race with POST /api/users/me.
    effect(() => {
      if (
        !this._apiLoaded &&
        this.auth.isResolved() &&
        this.auth.isAuthenticated() &&
        this.auth.isProvisioned() &&
        this.network.isOnline()
      ) {
        this._apiLoaded = true;
        this._syncState.set('loading');

        this.api.getExpiryRecords().subscribe({
          next: apiRecords => {
            const localRecords = this.loadLocal();
            const localHasData = Object.keys(localRecords).length > 0;
            const apiIsEmpty = Object.keys(apiRecords).length === 0;

            if (apiIsEmpty && localHasData) {
              // First login with existing local data — push local state up to
              // the API rather than silently wiping the user's saved dates.
              this._records.set(localRecords);
              this._syncState.set('synced');
              this._pushLocalToApi(localRecords);
            } else {
              // API has data (or both empty) — API is source of truth.
              this._records.set(apiRecords);
              this.saveLocal(apiRecords);
              this._syncState.set('synced');
            }
          },
          error: err => {
            console.error('[ExpiryService] API load failed, using localStorage cache:', err);
            this._syncState.set('error');
            // Reset so the effect can retry when network comes back online
            this._apiLoaded = false;
          },
        });
      }
    });
  }

  setLastActivity(cardId: string, date: string): void {
    if (!isValidDateString(date)) {
      console.error('[ExpiryService] Rejected invalid date:', date);
      return;
    }

    const updated = {
      ...this._records(),
      [cardId]: { cardId, lastActivityDate: date },
    };
    this._records.set(updated);
    this.saveLocal(updated);

    if (this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.setExpiryRecord(cardId, date).subscribe({
        error: err => console.error('[ExpiryService] API sync failed:', err),
      });
    }
  }

  clearActivity(cardId: string): void {
    const updated = { ...this._records() };
    delete updated[cardId];
    this._records.set(updated);
    this.saveLocal(updated);

    if (this.auth.isProvisioned() && this.network.isOnline()) {
      this.api.deleteExpiryRecord(cardId).subscribe({
        error: err => console.error('[ExpiryService] API delete failed:', err),
      });
    }
  }

  private _pushLocalToApi(records: Record<string, ExpiryRecord>): void {
    for (const { cardId, lastActivityDate } of Object.values(records)) {
      this.api.setExpiryRecord(cardId, lastActivityDate).subscribe({
        error: err =>
          console.error(`[ExpiryService] Failed to push local ${cardId} to API:`, err),
      });
    }
  }

  private computeStatus(rule: ExpiryRule, record: ExpiryRecord | undefined): ExpiryStatus {
    const base = {
      cardId: rule.cardId,
      programName: rule.programName,
      note: rule.note,
      quickActions: rule.quickActions ?? [],
    };

    if (rule.expiryType === 'never' || SAFE_CARDS.has(rule.cardId)) {
      return {
        ...base,
        daysRemaining: null,
        urgency: 'never',
        expiryDate: null,
        actionNeeded: 'No action needed — points do not expire while your card is open.',
      };
    }

    if (!record || !isValidDateString(record.lastActivityDate)) {
      return {
        ...base,
        daysRemaining: null,
        urgency: 'warning',
        expiryDate: null,
        actionNeeded: 'Set your last activity date so Tally can track expiry.',
      };
    }

    const lastActivity = this.parseLocalDate(record.lastActivityDate);
    const expiryDate = new Date(lastActivity);
    expiryDate.setMonth(expiryDate.getMonth() + (rule.inactivityMonths ?? 18));
    expiryDate.setHours(0, 0, 0, 0);

    const today = this.startOfLocalDay(new Date());
    const daysRemaining = Math.round((expiryDate.getTime() - today.getTime()) / MS_PER_DAY);

    let urgency: ExpiryStatus['urgency'];
    let actionNeeded: string;

    if (daysRemaining < 0) {
      urgency = 'expired';
      actionNeeded = 'Points may have expired. Contact the program immediately to request reinstatement.';
    } else if (daysRemaining <= 30) {
      urgency = 'critical';
      actionNeeded = `Act now — make a qualifying transaction within ${daysRemaining} days to reset the clock.`;
    } else if (daysRemaining <= 90) {
      urgency = 'warning';
      actionNeeded = `Make a purchase or transfer within ${daysRemaining} days to keep points active.`;
    } else {
      urgency = 'safe';
      actionNeeded = "You're in good shape. Check back in a few months.";
    }

    return { ...base, daysRemaining, urgency, expiryDate, actionNeeded };
  }

  private loadLocal(): Record<string, ExpiryRecord> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, ExpiryRecord>) : {};
    } catch {
      return {};
    }
  }

  private saveLocal(data: Record<string, ExpiryRecord>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable — not a fatal error
    }
  }

  private parseLocalDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, (month ?? 1) - 1, day ?? 1);
  }

  private startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}

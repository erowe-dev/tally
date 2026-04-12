import { Injectable, signal, computed } from '@angular/core';

export interface ExpiryRule {
  cardId: string;
  programName: string;
  expiryType: 'activity' | 'fixed' | 'never';
  /** months of inactivity before expiry (for 'activity' type) */
  inactivityMonths?: number;
  /** fixed expiry in months from earn date (for 'fixed' type) */
  fixedMonths?: number;
  note: string;
}

export interface ExpiryRecord {
  cardId: string;
  lastActivityDate: string; // ISO date string
}

export interface ExpiryStatus {
  cardId: string;
  programName: string;
  daysRemaining: number | null;
  urgency: 'safe' | 'warning' | 'critical' | 'expired' | 'never';
  expiryDate: Date | null;
  note: string;
  actionNeeded: string;
}

const STORAGE_KEY = 'tally_expiry_v1';

const EXPIRY_RULES: ExpiryRule[] = [
  {
    cardId: 'amex_mr',
    programName: 'Amex Membership Rewards',
    expiryType: 'activity',
    inactivityMonths: 0, // Never expire while card is open
    note: 'Points expire only when you close all earning MR cards.',
    // Special case — handled below
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
  },
];

// Programs where expiry is "never" or tied to card open status
const SAFE_CARDS = new Set(['amex_mr', 'chase_ur', 'cap1_miles']);

@Injectable({ providedIn: 'root' })
export class ExpiryService {
  private _records = signal<Record<string, ExpiryRecord>>(this.load());

  readonly records = this._records.asReadonly();

  readonly statuses = computed<ExpiryStatus[]>(() => {
    const records = this._records();
    return EXPIRY_RULES.map(rule => this.computeStatus(rule, records[rule.cardId]));
  });

  readonly hasWarnings = computed(() =>
    this.statuses().some(s => s.urgency === 'warning' || s.urgency === 'critical' || s.urgency === 'expired')
  );

  readonly criticalCount = computed(() =>
    this.statuses().filter(s => s.urgency === 'critical' || s.urgency === 'expired').length
  );

  setLastActivity(cardId: string, date: string): void {
    const updated = {
      ...this._records(),
      [cardId]: { cardId, lastActivityDate: date }
    };
    this._records.set(updated);
    this.save(updated);
  }

  clearActivity(cardId: string): void {
    const updated = { ...this._records() };
    delete updated[cardId];
    this._records.set(updated);
    this.save(updated);
  }

  private computeStatus(rule: ExpiryRule, record: ExpiryRecord | undefined): ExpiryStatus {
    const base = {
      cardId: rule.cardId,
      programName: rule.programName,
      note: rule.note,
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

    if (!record) {
      // No activity date set — prompt user
      return {
        ...base,
        daysRemaining: null,
        urgency: 'warning',
        expiryDate: null,
        actionNeeded: 'Set your last activity date so Tally can track expiry.',
      };
    }

    const lastActivity = new Date(record.lastActivityDate);
    const expiryDate = new Date(lastActivity);
    expiryDate.setMonth(expiryDate.getMonth() + (rule.inactivityMonths ?? 18));

    const now = new Date();
    const msRemaining = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));

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
      actionNeeded = 'You\'re in good shape. Check back in a few months.';
    }

    return { ...base, daysRemaining, urgency, expiryDate, actionNeeded };
  }

  private load(): Record<string, ExpiryRecord> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  private save(data: Record<string, ExpiryRecord>): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }
}

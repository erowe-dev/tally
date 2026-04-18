import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OptimizerService } from '../../core/services/optimizer.service';
import { WalletService } from '../../core/services/wallet.service';
import { DataService } from '../../core/services/data.service';
import { TripsService } from '../../core/services/trips.service';
import { Recommendation, CabinClass, HotelCategory } from '../../core/models';

@Component({
  selector: 'tally-optimizer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-content">
      <div class="section-eyebrow">Transfer Optimizer</div>
      <h2 class="section-title">Find the <em>best use</em><br>of your points</h2>

      <div class="toggle-row">
        <div class="type-toggle">
          <button class="toggle-btn" [class.active]="tripType() === 'flight'" (click)="tripType.set('flight')">
            ✈ Flights
          </button>
          <button class="toggle-btn" [class.active]="tripType() === 'hotel'" (click)="tripType.set('hotel')">
            🏨 Hotels
          </button>
        </div>
      </div>

      <!-- Flight fields -->
      <div class="fields" *ngIf="tripType() === 'flight'">
        <div class="field-row">
          <div class="field">
            <label class="field-label">From</label>
            <input class="field-input" [(ngModel)]="fromCity" placeholder="ORD"
                   maxlength="3" (input)="fromCity = fromCity.toUpperCase()">
          </div>
          <div class="field">
            <label class="field-label">To</label>
            <input class="field-input" [(ngModel)]="toCity" placeholder="LHR"
                   maxlength="3" (input)="toCity = toCity.toUpperCase()">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label">Cabin</label>
            <select class="field-input" [(ngModel)]="cabin">
              <option value="economy">Economy</option>
              <option value="premium">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First Class</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">Passengers</label>
            <select class="field-input" [(ngModel)]="passengers">
              <option [value]="1">1 Passenger</option>
              <option [value]="2">2 Passengers</option>
              <option [value]="3">3 Passengers</option>
              <option [value]="4">4 Passengers</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Hotel fields -->
      <div class="fields" *ngIf="tripType() === 'hotel'">
        <div class="field-row">
          <div class="field full">
            <label class="field-label">Destination</label>
            <input
              class="field-input is-disabled"
              [value]="hotelDest"
              placeholder="Destination-aware hotel search coming soon"
              disabled
              aria-describedby="hotel-destination-note">
          </div>
        </div>
        <p class="field-note" id="hotel-destination-note">
          Hotel recommendations currently use category and nights only.
        </p>
        <div class="field-row">
          <div class="field">
            <label class="field-label">Category</label>
            <select class="field-input" [(ngModel)]="hotelCategory">
              <option value="budget">Budget (Cat 1–2)</option>
              <option value="mid">Mid-range (Cat 3–4)</option>
              <option value="luxury">Luxury (Cat 5–6)</option>
              <option value="top">Top Tier (Cat 7–8)</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">Nights</label>
            <select class="field-input" [(ngModel)]="hotelNights">
              <option [value]="1">1 Night</option>
              <option [value]="3">3 Nights</option>
              <option [value]="5">5 Nights</option>
              <option [value]="7">7 Nights</option>
            </select>
          </div>
        </div>
      </div>

      <button class="btn-analyze" (click)="analyze()">Analyze Transfers →</button>

      <!-- Empty state -->
      <div class="empty-state" *ngIf="!results().length && !analyzed()">
        <div class="empty-icon">⚡</div>
        <p>Enter your trip details<br>to see the best transfers</p>
      </div>

      <!-- Results -->
      <div class="results" *ngIf="results().length">
        <div class="results-header">
          <div>
            <span class="section-eyebrow">{{ filteredResults().length }} of {{ results().length }} Options</span>
            <span class="route-label" *ngIf="routeLabel()">{{ routeLabel() }}</span>
          </div>
        </div>

        <!-- Result filters (only when user has a wallet) -->
        <div class="result-filters" *ngIf="wallet.hasAnyPoints()">
          <button class="rf-btn" [class.active]="canAffordOnly()"
            (click)="canAffordOnly.set(!canAffordOnly())">
            ✓ Can afford
          </button>
          <div class="rf-sort">
            <button class="rf-btn" [class.active]="sortBy() === 'cpp'"
              (click)="sortBy.set('cpp')">Best CPP</button>
            <button class="rf-btn" [class.active]="sortBy() === 'coverage'"
              (click)="sortBy.set('coverage')">My Coverage</button>
          </div>
        </div>

        <div class="no-affordable" *ngIf="canAffordOnly() && filteredResults().length === 0">
          <p>No results match your current wallet. Add more points in Wallet to unlock options.</p>
        </div>

        <div class="result-card"
             *ngFor="let rec of filteredResults(); let i = index"
             [class.best]="i === 0"
             [style.animation-delay]="i * 60 + 'ms'">
          <div class="rc-top">
            <div class="rc-left">
              <div class="rc-program">
                {{ rec.program }}
                <span class="covered-badge" *ngIf="wallet.canCover(rec.cards, rec.ptsRequired ?? 0)">✓</span>
              </div>
              <div class="rc-partner">{{ rec.partner }}</div>
              <div class="rc-note">{{ rec.note }}</div>
            </div>
            <div class="rc-pts">
              {{ (rec.ptsRequired ?? rec.ptsBase) | number }}
              <small>pts needed</small>
              <div class="rc-cash">~\${{ getCashValue(rec) | number }}</div>
            </div>
          </div>
          <div class="rc-bar-row">
            <div class="rc-bar-wrap">
              <div class="rc-bar" [style.width]="getBarPct(rec) + '%'"></div>
            </div>
            <span class="rc-cpp">~{{ rec.cpp }}¢/pt</span>
          </div>

          <!-- Wallet coverage row (only when user has a balance in a matching card) -->
          <div class="rc-coverage" *ngIf="wallet.hasAnyPoints()">
            <div class="rc-cov-bar-wrap">
              <div class="rc-cov-bar"
                [style.width]="getCovPct(rec) + '%'"
                [class.full]="getCovPct(rec) >= 100">
              </div>
            </div>
            <span class="rc-cov-label"
              [class.covered]="wallet.canCover(rec.cards, rec.ptsRequired ?? 0)">
              {{ getBestBalance(rec) | number }}
              <span class="rc-cov-sep">/</span>
              {{ (rec.ptsRequired ?? rec.ptsBase) | number }} pts
            </span>
          </div>

          <div class="rc-chips">
            <span class="chip" *ngFor="let cid of rec.cards">{{ getShort(cid) }}</span>
          </div>
          <div class="best-badge" *ngIf="i === 0">BEST VALUE</div>

          <button class="save-btn" (click)="saveTrip(rec)" [class.saved]="justSaved() === rec.program">
            {{ justSaved() === rec.program ? '✓ Saved' : '+ Save' }}
          </button>
        </div>

        <p class="disclaimer">
          ¢/pt values are estimates. Actual value varies by route and availability.
          Add balances in Wallet for coverage indicators.
        </p>
      </div>

      <!-- No results state -->
      <div class="no-results" *ngIf="analyzed() && !results().length">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-title">No matches found</div>
        <p>Try a different route or relax your cabin preference. Our data covers major international routes.</p>
      </div>

      <!-- Saved Trips -->
      <div class="saved-section" *ngIf="trips.trips().length > 0">
        <div class="section-eyebrow" style="margin-top:28px; margin-bottom:12px;">
          Saved Trips ({{ trips.trips().length }})
        </div>
        <div class="saved-card" *ngFor="let trip of trips.trips()">
          <div class="trip-type-icon">{{ trip.tripType === 'flight' ? '✈' : '🏨' }}</div>
          <div class="saved-info">
            <div class="saved-program">{{ trip.programName }}</div>
            <div class="saved-meta">
              <ng-container *ngIf="trip.tripType === 'flight'">
                <span *ngIf="trip.origin">{{ trip.origin }}→{{ trip.destination }}</span>
                <span *ngIf="trip.cabin"> · {{ trip.cabin }}</span>
                <span *ngIf="trip.passengers && trip.passengers > 1"> · {{ trip.passengers }}pax</span>
              </ng-container>
              <ng-container *ngIf="trip.tripType === 'hotel'">
                <span *ngIf="trip.hotelCat">{{ trip.hotelCat }}</span>
                <span *ngIf="trip.nights"> · {{ trip.nights }} night{{ trip.nights !== 1 ? 's' : '' }}</span>
              </ng-container>
            </div>
            <!-- Inline note display / edit -->
            <div class="saved-note-area">
              <input *ngIf="editingNoteId() !== trip.id"
                class="saved-note-preview"
                readonly
                [value]="trip.notes || ''"
                placeholder="Add a note…"
                (click)="startEditNote(trip.id, trip.notes || '')"
              />
              <div class="saved-note-edit" *ngIf="editingNoteId() === trip.id">
                <input class="saved-note-input" [(ngModel)]="pendingNote"
                  placeholder="Add a note…" maxlength="500"
                  (keyup.enter)="commitNote(trip.id)"
                  (keyup.escape)="editingNoteId.set(null)">
                <button class="note-save-btn" (click)="commitNote(trip.id)">Save</button>
                <button class="note-cancel-btn" (click)="editingNoteId.set(null)">✕</button>
              </div>
            </div>
            <div class="saved-date">{{ formatTripDate(trip.createdAt) }}</div>
          </div>
          <div class="saved-pts">{{ trip.ptsRequired | number }}<small>pts</small></div>
          <button class="delete-btn" (click)="trips.deleteTrip(trip.id)" title="Remove">×</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .toggle-row { margin-bottom: 20px; }
    .type-toggle {
      display: inline-flex;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .toggle-btn {
      background: none; border: none;
      color: var(--text3);
      font-family: 'Geist', sans-serif;
      font-size: 13px; font-weight: 500;
      padding: 9px 18px;
      cursor: pointer;
      transition: all 0.18s;
    }
    .toggle-btn.active { background: var(--tally-green); color: white; }

    .fields { margin-bottom: 14px; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field.full { grid-column: 1 / -1; }
    .field-label {
      font-family: 'Geist Mono', monospace;
      font-size: 9px; letter-spacing: 0.15em;
      color: var(--text3); text-transform: uppercase;
    }
    .field-input {
      background: var(--white); border: 1.5px solid var(--border2);
      border-radius: 10px; color: var(--text);
      font-family: 'Geist', sans-serif; font-size: 14px; font-weight: 500;
      padding: 11px 14px; outline: none; width: 100%;
      transition: border-color 0.15s; -webkit-appearance: none;
    }
    .field-input:focus { border-color: var(--tally-green); }
    .field-input::placeholder { color: var(--text3); font-weight: 400; }
    select.field-input option { background: var(--white); color: var(--text); }
    .field-input.is-disabled {
      background: var(--surface);
      color: var(--text3);
      cursor: not-allowed;
      opacity: 1;
    }
    .field-note {
      margin: -2px 0 12px;
      font-family: 'Geist Mono', monospace;
      font-size: 10px;
      color: var(--text3);
      line-height: 1.45;
    }

    .btn-analyze {
      width: 100%; background: var(--tally-green); color: white;
      border: none; border-radius: 12px;
      font-family: 'Geist', sans-serif; font-size: 14px; font-weight: 600;
      letter-spacing: 0.02em; padding: 15px;
      cursor: pointer; margin-bottom: 4px;
      transition: opacity 0.15s, transform 0.1s;
    }
    .btn-analyze:active { transform: scale(0.98); opacity: 0.9; }

    .empty-state {
      text-align: center; padding: 48px 20px; color: var(--text3);
    }
    .empty-icon { font-size: 36px; margin-bottom: 12px; }
    .empty-state p {
      font-family: 'Instrument Serif', serif;
      font-style: italic; font-size: 18px; line-height: 1.5; color: var(--text2);
    }

    .results-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 24px; margin-bottom: 12px;
    }
    .results-hint { font-family: 'Geist Mono', monospace; font-size: 10px; color: var(--tally-green); }

    /* Result filter bar */
    .result-filters {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .rf-sort { display: flex; gap: 4px; margin-left: auto; }
    .rf-btn {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 4px 11px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.08em; color: var(--text3); cursor: pointer;
      transition: all 0.15s; white-space: nowrap;
    }
    .rf-btn.active { background: var(--tally-green); border-color: var(--tally-green); color: white; }
    .no-affordable {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 20px 16px; text-align: center;
      font-size: 13px; color: var(--text2); line-height: 1.5; margin-bottom: 12px;
    }
    .route-label {
      display: block; font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px;
    }

    .result-card {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 14px; padding: 16px; margin-bottom: 10px;
      position: relative; overflow: hidden;
      animation: fadeUp 0.35s ease both;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .result-card.best { border-color: var(--tally-green); background: var(--tally-green-light); }

    .rc-top { display: flex; gap: 12px; margin-bottom: 12px; }
    .rc-left { flex: 1; }
    .rc-program { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .covered-badge {
      display: inline-block; margin-left: 6px;
      color: var(--tally-green); font-size: 12px; font-weight: 700;
    }
    .rc-partner { font-size: 11px; color: var(--text2); margin-bottom: 2px; }
    .rc-note { font-size: 11px; color: var(--text3); font-style: italic; }
    .rc-pts { text-align: right; flex-shrink: 0; }
    .rc-pts {
      font-family: 'Geist Mono', monospace;
      font-size: 17px; color: var(--tally-green); white-space: nowrap;
    }
    .rc-pts small {
      display: block; font-size: 9px; color: var(--text3);
      letter-spacing: 0.08em; text-align: right; margin-top: 1px;
    }
    .rc-cash {
      font-family: 'Geist Mono', monospace; font-size: 11px;
      color: var(--tally-green); text-align: right; margin-top: 4px;
      font-weight: 600;
    }

    .rc-bar-row {
      display: flex; align-items: center; gap: 10px;
      padding-top: 10px; border-top: 1px solid var(--border);
      margin-bottom: 10px;
    }
    .rc-bar-wrap { flex: 1; height: 3px; background: var(--border); border-radius: 99px; overflow: hidden; }
    .rc-bar { height: 100%; background: var(--tally-green); border-radius: 99px; transition: width 0.5s cubic-bezier(0.34,1.56,0.64,1); }
    .rc-cpp { font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--tally-green-mid); white-space: nowrap; }

    /* Wallet coverage bar */
    .rc-coverage {
      display: flex; align-items: center; gap: 8px;
      margin-top: 6px; margin-bottom: 8px;
    }
    .rc-cov-bar-wrap { flex: 1; height: 3px; background: var(--border); border-radius: 99px; overflow: hidden; }
    .rc-cov-bar {
      height: 100%; background: var(--border2); border-radius: 99px;
      transition: width 0.5s cubic-bezier(0.34,1.56,0.64,1);
    }
    .rc-cov-bar.full { background: var(--tally-green); }
    .rc-cov-label {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); white-space: nowrap; flex-shrink: 0;
    }
    .rc-cov-label.covered { color: var(--tally-green); }
    .rc-cov-sep { margin: 0 2px; opacity: 0.5; }

    /* No results */
    .no-results { text-align: center; padding: 32px 16px; }
    .no-results-icon { font-size: 32px; margin-bottom: 10px; }
    .no-results-title {
      font-family: 'Instrument Serif', serif; font-size: 20px;
      color: var(--text); margin-bottom: 8px;
    }
    .no-results p { font-size: 13px; color: var(--text3); line-height: 1.55; }

    .rc-chips { display: flex; gap: 5px; flex-wrap: wrap; }
    .chip {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 6px; padding: 2px 8px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text2); letter-spacing: 0.05em;
    }

    .best-badge {
      position: absolute; top: 12px; right: 12px;
      background: var(--tally-green); color: white;
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.12em; padding: 3px 7px; border-radius: 4px;
    }

    .disclaimer {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); line-height: 1.6;
      letter-spacing: 0.05em; margin-top: 12px;
    }

    .save-btn {
      margin-top: 10px; background: none;
      border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace;
      font-size: 10px; letter-spacing: 0.08em; padding: 5px 10px;
      cursor: pointer; transition: all 0.15s;
    }
    .save-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .save-btn.saved { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }

    .saved-card {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 12px; padding: 12px 14px;
      display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
    }
    .trip-type-icon { font-size: 16px; flex-shrink: 0; opacity: 0.7; }
    .saved-info { flex: 1; min-width: 0; }
    .saved-program { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .saved-meta { font-family: 'Geist Mono', monospace; font-size: 10px; color: var(--text3); letter-spacing: 0.04em; }
    .saved-date {
      font-family: 'Geist Mono', monospace; font-size: 9px; color: var(--border2);
      letter-spacing: 0.04em; margin-top: 2px;
    }
    .saved-pts {
      font-family: 'Geist Mono', monospace; font-size: 14px;
      color: var(--tally-green); text-align: right; flex-shrink: 0;
    }
    .saved-pts small { display: block; font-size: 9px; color: var(--text3); }
    .delete-btn {
      background: none; border: none; color: var(--text3);
      font-size: 18px; line-height: 1; cursor: pointer; padding: 2px 4px;
      border-radius: 4px; transition: color 0.15s;
      flex-shrink: 0;
    }
    .delete-btn:hover { color: var(--tally-red); }

    .saved-note-area { margin-top: 4px; }
    .saved-note-preview {
      width: 100%; background: none; border: none; outline: none; cursor: pointer;
      font-family: 'Geist', sans-serif; font-size: 11px; color: var(--text3);
      padding: 0; line-height: 1.4;
    }
    .saved-note-preview:not([value=""]):not([value]) { color: var(--text2); }
    .saved-note-edit { display: flex; gap: 4px; align-items: center; }
    .saved-note-input {
      flex: 1; background: var(--surface); border: 1.5px solid var(--tally-green);
      border-radius: 7px; font-family: 'Geist', sans-serif; font-size: 11px;
      color: var(--text); padding: 4px 8px; outline: none;
    }
    .note-save-btn {
      background: var(--tally-green); border: none; border-radius: 6px;
      color: white; font-family: 'Geist Mono', monospace; font-size: 9px;
      padding: 4px 8px; cursor: pointer; flex-shrink: 0; letter-spacing: 0.06em;
    }
    .note-cancel-btn {
      background: none; border: none; color: var(--text3); font-size: 12px;
      cursor: pointer; padding: 2px; flex-shrink: 0;
    }
  `]
})
export class OptimizerComponent {
  private optimizer = inject(OptimizerService);
  private data = inject(DataService);
  wallet = inject(WalletService);
  trips = inject(TripsService);

  tripType = signal<'flight' | 'hotel'>('flight');
  fromCity = '';
  toCity = '';
  cabin: CabinClass = 'business';
  passengers = 1;
  hotelDest = '';
  hotelCategory: HotelCategory = 'mid';
  hotelNights = 5;

  results = signal<Recommendation[]>([]);
  analyzed = signal(false);
  maxCpp = signal(1);
  routeLabel = signal<string>('');
  editingNoteId = signal<string | null>(null);
  pendingNote = '';
  // Briefly highlights the save button after saving
  justSaved = signal<string | null>(null);
  // Filters / sorting for results
  canAffordOnly = signal(false);
  sortBy = signal<'cpp' | 'coverage'>('cpp');

  readonly filteredResults = computed<Recommendation[]>(() => {
    let recs = this.results();
    if (this.canAffordOnly()) {
      recs = recs.filter(r => this.wallet.canCover(r.cards, r.ptsRequired ?? r.ptsBase));
    }
    if (this.sortBy() === 'coverage' && this.wallet.hasAnyPoints()) {
      recs = [...recs].sort((a, b) => {
        const covA = this.getCovPct(a);
        const covB = this.getCovPct(b);
        if (covA !== covB) return covB - covA; // highest coverage first
        return b.cpp - a.cpp;
      });
    }
    return recs;
  });

  private static readonly ROUTE_LABELS: Record<string, string> = {
    transatlantic: 'US ↔ Europe',
    transpacific:  'US ↔ Asia/Pacific',
    domestic:      'US Domestic',
    latin_america: 'US ↔ Latin America',
    caribbean:     'US ↔ Caribbean',
    middle_east:   'US ↔ Middle East',
    africa:        'US ↔ Africa',
    eurasia:       'Europe ↔ Asia',
    default:       'Worldwide',
  };

  analyze(): void {
    let recs: Recommendation[];
    if (this.tripType() === 'flight') {
      const result = this.optimizer.getFlightRecs(this.fromCity, this.toCity, this.cabin, this.passengers);
      recs = result.recs;
      this.routeLabel.set(OptimizerComponent.ROUTE_LABELS[result.category] ?? '');
    } else {
      recs = this.optimizer.getHotelRecs(this.hotelCategory, this.hotelNights);
      this.routeLabel.set('');
    }
    this.maxCpp.set(recs[0]?.cpp ?? 1);
    this.results.set(recs);
    this.analyzed.set(true);
  }

  saveTrip(rec: Recommendation): void {
    const ptsRequired = rec.ptsRequired ?? rec.ptsBase;
    if (this.tripType() === 'flight') {
      this.trips.saveTrip({
        tripType: 'flight',
        origin: this.fromCity.toUpperCase() || undefined,
        destination: this.toCity.toUpperCase() || undefined,
        cabin: this.cabin,
        passengers: this.passengers,
        programName: rec.program,
        ptsRequired,
      });
    } else {
      this.trips.saveTrip({
        tripType: 'hotel',
        hotelCat: this.hotelCategory,
        nights: this.hotelNights,
        programName: rec.program,
        ptsRequired,
      });
    }
    this.justSaved.set(rec.program);
    setTimeout(() => this.justSaved.set(null), 2000);
  }

  getBarPct(rec: Recommendation): number {
    return Math.round((rec.cpp / this.maxCpp()) * 100);
  }

  /** Best balance the user holds across the recommendation's eligible cards */
  getBestBalance(rec: Recommendation): number {
    return Math.max(0, ...rec.cards.map(id => this.wallet.getBalance(id)));
  }

  /** Estimated cash value of the redemption */
  getCashValue(rec: Recommendation): number {
    const pts = rec.ptsRequired ?? rec.ptsBase;
    return Math.round(pts * rec.cpp / 100);
  }

  /** Percentage of required points the user already has (0–100, capped at 100) */
  getCovPct(rec: Recommendation): number {
    const required = rec.ptsRequired ?? rec.ptsBase;
    if (!required) return 0;
    return Math.min(100, Math.round((this.getBestBalance(rec) / required) * 100));
  }

  getShort(cardId: string): string {
    return this.data.cards.find(c => c.id === cardId)?.short ?? cardId;
  }

  startEditNote(tripId: string, currentNote: string): void {
    this.pendingNote = currentNote;
    this.editingNoteId.set(tripId);
  }

  commitNote(tripId: string): void {
    this.trips.updateNotes(tripId, this.pendingNote);
    this.editingNoteId.set(null);
  }

  formatTripDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  }
}

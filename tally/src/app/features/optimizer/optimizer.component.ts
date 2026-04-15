import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OptimizerService } from '../../core/services/optimizer.service';
import { WalletService } from '../../core/services/wallet.service';
import { DataService } from '../../core/services/data.service';
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
          <span class="section-eyebrow">{{ results().length }} Options</span>
          <span class="results-hint" *ngIf="wallet.hasAnyPoints()">✓ = you have enough</span>
        </div>

        <div class="result-card"
             *ngFor="let rec of results(); let i = index"
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
            </div>
          </div>
          <div class="rc-bar-row">
            <div class="rc-bar-wrap">
              <div class="rc-bar" [style.width]="getBarPct(rec) + '%'"></div>
            </div>
            <span class="rc-cpp">~{{ rec.cpp }}¢/pt</span>
          </div>
          <div class="rc-chips">
            <span class="chip" *ngFor="let cid of rec.cards">{{ getShort(cid) }}</span>
          </div>
          <div class="best-badge" *ngIf="i === 0">BEST VALUE</div>
        </div>

        <p class="disclaimer">
          ¢/pt values are estimates. Actual value varies by route and availability.
          Add balances in Wallet for coverage indicators.
        </p>
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

    .rc-bar-row {
      display: flex; align-items: center; gap: 10px;
      padding-top: 10px; border-top: 1px solid var(--border);
      margin-bottom: 10px;
    }
    .rc-bar-wrap { flex: 1; height: 3px; background: var(--border); border-radius: 99px; overflow: hidden; }
    .rc-bar { height: 100%; background: var(--tally-green); border-radius: 99px; transition: width 0.5s cubic-bezier(0.34,1.56,0.64,1); }
    .rc-cpp { font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--tally-green-mid); white-space: nowrap; }

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
  `]
})
export class OptimizerComponent {
  private optimizer = inject(OptimizerService);
  private data = inject(DataService);
  wallet = inject(WalletService);

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

  analyze(): void {
    let recs: Recommendation[];
    if (this.tripType() === 'flight') {
      recs = this.optimizer.getFlightRecs(this.fromCity, this.toCity, this.cabin, this.passengers);
    } else {
      recs = this.optimizer.getHotelRecs(this.hotelCategory, this.hotelNights);
    }
    this.maxCpp.set(recs[0]?.cpp ?? 1);
    this.results.set(recs);
    this.analyzed.set(true);
  }

  getBarPct(rec: Recommendation): number {
    return Math.round((rec.cpp / this.maxCpp()) * 100);
  }

  getShort(cardId: string): string {
    return this.data.cards.find(c => c.id === cardId)?.short ?? cardId;
  }
}

import { Component, signal, computed, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OptimizerService } from '../../core/services/optimizer.service';
import { WalletService } from '../../core/services/wallet.service';
import { DataService } from '../../core/services/data.service';
import { TripsService } from '../../core/services/trips.service';
import { Recommendation, CabinClass, HotelCategory } from '../../core/models';

interface RouteHistoryEntry {
  tripType: 'flight' | 'hotel';
  fromCity: string; toCity: string; cabin: CabinClass; passengers: number;
  hotelCategory: HotelCategory; hotelNights: number;
  label: string; ts: string;
}
const ROUTE_HISTORY_KEY = 'tally_route_history_v1';
const MAX_ROUTE_HISTORY = 5;

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
            <label class="field-label">Destination (optional)</label>
            <input
              class="field-input"
              [(ngModel)]="hotelDest"
              placeholder="Tokyo, Maldives, Paris…"
              aria-label="Hotel destination">
          </div>
        </div>
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

      <!-- Recent searches -->
      <div class="recent-routes" *ngIf="recentRoutes().length > 0">
        <span class="recent-label">Recent</span>
        <div class="recent-chips">
          <button class="recent-chip" *ngFor="let h of recentRoutes()" (click)="applyHistory(h)"
            [title]="'Re-run: ' + h.label">
            {{ h.tripType === 'flight' ? '✈' : '🏨' }} {{ h.label }}
          </button>
        </div>
      </div>

      <button class="btn-analyze" (click)="analyze()">Analyze Transfers →</button>

      <!-- Quick Wins toggle — only shown when user has wallet data -->
      <button class="btn-quick-wins" *ngIf="wallet.hasAnyPoints()"
        (click)="toggleQuickWins()">
        {{ showQuickWins() ? '✕ Hide' : '⚡ What can I book now?' }}
      </button>

      <!-- Quick Wins panel -->
      <div class="quick-wins-panel" *ngIf="showQuickWins()">
        <div class="qw-header">
          <span class="section-eyebrow">{{ quickWins().length }} Affordable Options</span>
          <span class="qw-sub">Based on your current wallet balances</span>
        </div>
        <div class="result-card qw-card"
          *ngFor="let rec of quickWins(); let i = index"
          [style.animation-delay]="i * 40 + 'ms'">
          <div class="rc-top">
            <div class="rc-left">
              <div class="rc-program">
                {{ rec.tripType === 'flight' ? '✈' : '🏨' }} {{ rec.program }}
                <span class="covered-badge">✓</span>
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
              <div class="rc-bar" [style.width]="getQwBarPct(rec) + '%'"></div>
            </div>
            <span class="rc-cpp">~{{ rec.cpp }}¢/pt</span>
          </div>
          <div class="rc-chips">
            <span class="chip" *ngFor="let cid of rec.cards">{{ getShort(cid) }}</span>
          </div>
        </div>
        <div class="qw-empty" *ngIf="quickWins().length === 0">
          <p>Your balances don't yet cover any individual redemption. Keep earning!</p>
        </div>
      </div>

      <!-- Empty state -->
      <div class="empty-state" *ngIf="!results().length && !analyzed() && !showQuickWins()">
        <div class="empty-icon">⚡</div>
        <p>Enter your trip details<br>to see the best transfers</p>
        <!-- Wallet-aware suggestion: surfaces when user has points -->
        <div class="wallet-hint" *ngIf="walletSuggestion() as hint">
          <div class="wh-label">Suggested for your wallet</div>
          <button class="wh-card" (click)="applyWalletSuggestion(hint)">
            <span class="wh-icon">💡</span>
            <div class="wh-body">
              <div class="wh-title">{{ hint.title }}</div>
              <div class="wh-sub">{{ hint.sub }}</div>
            </div>
            <span class="wh-arrow">→</span>
          </button>
        </div>
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
                <span class="already-saved-badge" *ngIf="isAlreadySaved(rec.program)">★ Saved</span>
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

          <div class="card-action-row">
            <button class="save-btn" (click)="saveTrip(rec)" [class.saved]="justSaved() === rec.program">
              {{ justSaved() === rec.program ? '✓ Saved' : '+ Save' }}
            </button>
            <button class="copy-btn" *ngIf="i === 0"
              (click)="copyTopResult(rec)" [class.copied]="copiedResult()">
              {{ copiedResult() ? '✓ Copied' : '📋 Share' }}
            </button>
            <button class="howto-btn" *ngIf="getHowToSteps(rec.program).length > 0"
              (click)="toggleHowTo(rec.program)"
              [class.open]="expandedHowTo() === rec.program">
              {{ expandedHowTo() === rec.program ? 'Hide steps' : 'How to book' }}
            </button>
          </div>
          <!-- How-to panel -->
          <div class="howto-panel" *ngIf="expandedHowTo() === rec.program">
            <ol class="howto-steps">
              <li *ngFor="let step of getHowToSteps(rec.program)">{{ step }}</li>
            </ol>
            <a *ngIf="getBookingUrl(rec.program) as url"
              class="howto-link" [href]="'https://' + url" target="_blank" rel="noopener">
              🌐 {{ url }}
            </a>
          </div>
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
        <div class="saved-section-header">
          <span class="section-eyebrow">Saved Trips ({{ trips.trips().length }})</span>
          <button class="clear-all-btn" [class.confirm]="clearConfirm()" (click)="clearAllTrips()">
            {{ clearConfirm() ? '⚠ Confirm clear?' : 'Clear all' }}
          </button>
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
                <span *ngIf="trip.destination">{{ trip.destination }} · </span>
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
          <div class="saved-actions">
            <button class="reanalyze-btn" (click)="reanalyzeTrip(trip)" title="Re-run analysis">↺</button>
            <button class="delete-btn" (click)="trips.deleteTrip(trip.id)" title="Remove">×</button>
          </div>
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

    .btn-quick-wins {
      width: 100%; background: var(--tally-green-light); color: var(--tally-green);
      border: 1px solid rgba(26,122,74,0.25); border-radius: 12px;
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 500;
      padding: 11px; cursor: pointer; margin-bottom: 4px;
      transition: all 0.15s; letter-spacing: 0.01em;
    }
    .btn-quick-wins:hover { background: rgba(26,122,74,0.12); }

    .quick-wins-panel { margin: 12px 0; }
    .qw-header { margin-bottom: 10px; }
    .qw-sub {
      display: block; font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); letter-spacing: 0.08em; margin-top: 2px;
    }
    .qw-card { border-left: 3px solid var(--tally-green); }
    .qw-empty {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 20px; text-align: center;
      font-size: 13px; color: var(--text2); line-height: 1.5;
    }

    .empty-state {
      text-align: center; padding: 48px 20px 20px; color: var(--text3);
    }
    .empty-icon { font-size: 36px; margin-bottom: 12px; }
    .empty-state p {
      font-family: 'Instrument Serif', serif;
      font-style: italic; font-size: 18px; line-height: 1.5; color: var(--text2);
    }
    .wallet-hint { margin-top: 20px; text-align: left; }
    .wh-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--text3); margin-bottom: 8px;
    }
    .wh-card {
      width: 100%; display: flex; align-items: center; gap: 10px;
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2);
      border-radius: 12px; padding: 12px 14px; cursor: pointer; text-align: left;
      transition: all 0.15s;
    }
    .wh-card:hover { background: rgba(26,122,74,0.12); border-color: var(--tally-green); }
    .wh-icon { font-size: 18px; flex-shrink: 0; }
    .wh-body { flex: 1; min-width: 0; }
    .wh-title { font-size: 13px; font-weight: 600; color: var(--tally-green); margin-bottom: 2px; }
    .wh-sub { font-size: 11px; color: var(--tally-green-mid, #2d9e62); line-height: 1.4; }
    .wh-arrow { font-size: 16px; color: var(--tally-green); flex-shrink: 0; }

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
    .already-saved-badge {
      display: inline-block; margin-left: 6px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--tally-amber, #d97706); letter-spacing: 0.06em;
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

    .card-action-row { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }

    /* How-to-Book button and panel */
    .howto-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.06em; padding: 5px 10px; cursor: pointer;
      transition: all 0.15s; margin-left: auto;
    }
    .howto-btn:hover, .howto-btn.open {
      border-color: var(--tally-green); color: var(--tally-green);
    }
    .howto-panel {
      margin-top: 10px; padding: 12px 14px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; animation: fadeUp 0.2s ease both;
    }
    .howto-steps {
      margin: 0 0 8px 0; padding-left: 18px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .howto-steps li { font-size: 12px; color: var(--text2); line-height: 1.5; }
    .howto-link {
      display: inline-block; font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--tally-green); letter-spacing: 0.04em;
      text-decoration: none; margin-top: 4px;
    }
    .howto-link:hover { text-decoration: underline; }
    .save-btn {
      background: none;
      border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace;
      font-size: 10px; letter-spacing: 0.08em; padding: 5px 10px;
      cursor: pointer; transition: all 0.15s;
    }
    .save-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .save-btn.saved { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }
    .copy-btn {
      background: none;
      border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace;
      font-size: 10px; letter-spacing: 0.08em; padding: 5px 10px;
      cursor: pointer; transition: all 0.15s;
    }
    .copy-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .copy-btn.copied { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }

    .saved-section-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-top: 28px; margin-bottom: 12px;
    }
    .clear-all-btn {
      background: none; border: none;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.08em; color: var(--text3); cursor: pointer;
      padding: 3px 8px; border-radius: 6px; transition: all 0.15s;
    }
    .clear-all-btn:hover { color: var(--tally-red); }
    .clear-all-btn.confirm {
      color: var(--tally-red); background: rgba(220,38,38,0.08);
      border: 1px solid rgba(220,38,38,0.25);
    }

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
    .saved-actions { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
    .reanalyze-btn {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      color: var(--text3); font-size: 14px; line-height: 1;
      cursor: pointer; padding: 3px 6px; transition: all 0.15s;
    }
    .reanalyze-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
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

    /* Recent routes */
    .recent-routes {
      display: flex; align-items: flex-start; gap: 8px;
      margin-bottom: 12px; flex-wrap: wrap;
    }
    .recent-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.12em; text-transform: uppercase; color: var(--text3);
      flex-shrink: 0; padding-top: 5px;
    }
    .recent-chips { display: flex; gap: 5px; flex-wrap: wrap; flex: 1; }
    .recent-chip {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 4px 11px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.03em; color: var(--text2); cursor: pointer;
      transition: all 0.15s; white-space: nowrap;
    }
    .recent-chip:hover {
      border-color: var(--tally-green); color: var(--tally-green);
      background: var(--tally-green-light);
    }
  `]
})
export class OptimizerComponent implements OnChanges {
  @Input() prefill: { fromCity?: string; toCity?: string; cabin?: string } | null = null;
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
  // Briefly highlights the copy button after copying
  copiedResult = signal(false);
  // Filters / sorting for results
  canAffordOnly = signal(false);
  sortBy = signal<'cpp' | 'coverage'>('cpp');
  // Quick Wins panel
  showQuickWins = signal(false);
  // Two-step confirm for clearing all saved trips
  clearConfirm = signal(false);
  // Tracks which result card has the "How to Book" panel open
  expandedHowTo = signal<string | null>(null);
  private _clearConfirmTimer: ReturnType<typeof setTimeout> | null = null;
  private _allRecs = this.optimizer.getAllRecs();
  // Route history
  private _routeHistory = signal<RouteHistoryEntry[]>(this.loadRouteHistory());
  readonly recentRoutes = this._routeHistory.asReadonly();

  readonly quickWins = computed(() => {
    return this._allRecs.filter(r =>
      this.wallet.canCover(r.cards, r.ptsRequired ?? r.ptsBase)
    );
  });

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
    this.pushToHistory();
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
        destination: this.hotelDest.trim() || undefined,
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

  toggleQuickWins(): void {
    this.showQuickWins.update(v => !v);
    // Reset the standard results when entering quick wins mode
    if (this.showQuickWins()) {
      this.results.set([]);
      this.analyzed.set(false);
    }
  }

  getQwBarPct(rec: Recommendation): number {
    const maxCpp = Math.max(...this._allRecs.map(r => r.cpp));
    return Math.round((rec.cpp / maxCpp) * 100);
  }

  isAlreadySaved(programName: string): boolean {
    return this.trips.trips().some(t => t.programName === programName);
  }

  reanalyzeTrip(trip: import('../../core/models').SavedTrip): void {
    this.tripType.set(trip.tripType);
    if (trip.tripType === 'flight') {
      this.fromCity = trip.origin ?? '';
      this.toCity   = trip.destination ?? '';
      if (trip.cabin) this.cabin = trip.cabin;
      if (trip.passengers) this.passengers = trip.passengers;
    } else {
      if (trip.hotelCat) this.hotelCategory = trip.hotelCat;
      if (trip.nights) this.hotelNights = trip.nights;
    }
    this.showQuickWins.set(false);
    this.analyze();
    // Scroll to top of page-content
    document.querySelector('.page-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  startEditNote(tripId: string, currentNote: string): void {
    this.pendingNote = currentNote;
    this.editingNoteId.set(tripId);
  }

  commitNote(tripId: string): void {
    this.trips.updateNotes(tripId, this.pendingNote);
    this.editingNoteId.set(null);
  }

  ngOnChanges(changes: SimpleChanges): void {
    const p = changes['prefill']?.currentValue as { fromCity?: string; toCity?: string; cabin?: string } | null;
    if (!p) return;
    this.tripType.set('flight');
    if (p.fromCity) this.fromCity = p.fromCity;
    if (p.toCity)   this.toCity   = p.toCity;
    if (p.cabin && ['economy','premium','business','first'].includes(p.cabin)) {
      this.cabin = p.cabin as CabinClass;
    }
    this.showQuickWins.set(false);
    this.analyze();
  }

  // ── Route history ──────────────────────────────────────────────────────────
  private loadRouteHistory(): RouteHistoryEntry[] {
    try {
      const raw = localStorage.getItem(ROUTE_HISTORY_KEY);
      return raw ? (JSON.parse(raw) as RouteHistoryEntry[]) : [];
    } catch { return []; }
  }

  private saveRouteHistory(entries: RouteHistoryEntry[]): void {
    try { localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(entries)); } catch {}
  }

  private buildHistoryLabel(): string {
    if (this.tripType() === 'flight') {
      const from = this.fromCity || '?';
      const to   = this.toCity   || '?';
      const cab  = this.cabin.charAt(0).toUpperCase() + this.cabin.slice(1);
      const pax  = this.passengers > 1 ? ` · ${this.passengers}pax` : '';
      return `${from}→${to} · ${cab}${pax}`;
    }
    const catMap: Record<HotelCategory, string> = {
      budget: 'Budget', mid: 'Mid-Range', luxury: 'Luxury', top: 'Top Tier',
    };
    return `${catMap[this.hotelCategory]} · ${this.hotelNights}n`;
  }

  private pushToHistory(): void {
    const entry: RouteHistoryEntry = {
      tripType: this.tripType(),
      fromCity: this.fromCity, toCity: this.toCity,
      cabin: this.cabin, passengers: this.passengers,
      hotelCategory: this.hotelCategory, hotelNights: this.hotelNights,
      label: this.buildHistoryLabel(),
      ts: new Date().toISOString(),
    };
    this._routeHistory.update(prev => {
      const deduped = prev.filter(h => h.label !== entry.label);
      const next = [entry, ...deduped].slice(0, MAX_ROUTE_HISTORY);
      this.saveRouteHistory(next);
      return next;
    });
  }

  applyHistory(entry: RouteHistoryEntry): void {
    this.tripType.set(entry.tripType);
    this.fromCity = entry.fromCity;
    this.toCity   = entry.toCity;
    this.cabin    = entry.cabin;
    this.passengers   = entry.passengers;
    this.hotelCategory = entry.hotelCategory;
    this.hotelNights  = entry.hotelNights;
    // Close quick wins if open so user sees results
    this.showQuickWins.set(false);
    this.analyze();
  }

  /**
   * When the user has wallet balances but hasn't analyzed anything yet,
   * suggests a relevant route/type based on their largest balance and best CPP partner.
   */
  readonly walletSuggestion = computed((): { title: string; sub: string; tripType: 'flight' | 'hotel'; programCat: string } | null => {
    if (!this.wallet.hasAnyPoints() || this.analyzed() || this.showQuickWins()) return null;

    // Find the card with the largest balance
    let bestCard: { id: string; balance: number; name: string; category: string; topCpp: number; topPartner: string } | null = null;
    for (const card of this.data.cards) {
      const bal = this.wallet.getBalance(card.id);
      if (bal <= 0) continue;
      const topPartner = card.partners.reduce((m, p) => p.cpp > m.cpp ? p : m, card.partners[0]);
      if (!topPartner) continue;
      if (!bestCard || bal > bestCard.balance) {
        bestCard = { id: card.id, balance: bal, name: card.name, category: card.category, topCpp: topPartner.cpp, topPartner: topPartner.name };
      }
    }
    if (!bestCard) return null;

    if (bestCard.category === 'hotel') {
      return {
        title: `Try hotel search with ${bestCard.name}`,
        sub: `${bestCard.balance.toLocaleString()} pts — best hotel CPP: ${bestCard.topCpp}¢ via ${bestCard.topPartner}`,
        tripType: 'hotel',
        programCat: 'mid',
      };
    }
    return {
      title: `Find flights with ${bestCard.name}`,
      sub: `${bestCard.balance.toLocaleString()} pts — best value: ${bestCard.topCpp}¢/pt via ${bestCard.topPartner}`,
      tripType: 'flight',
      programCat: 'flight',
    };
  });

  applyWalletSuggestion(hint: { tripType: 'flight' | 'hotel'; programCat: string }): void {
    this.tripType.set(hint.tripType);
    if (hint.tripType === 'hotel') {
      this.hotelCategory = 'mid';
    }
    this.showQuickWins.set(false);
    this.analyze();
  }

  copyTopResult(rec: Recommendation): void {
    const pts = (rec.ptsRequired ?? rec.ptsBase).toLocaleString();
    const val = `$${this.getCashValue(rec).toLocaleString()}`;
    const route = this.tripType() === 'flight'
      ? (this.fromCity && this.toCity ? `${this.fromCity}→${this.toCity} · ${this.cabin}` : this.cabin)
      : `${this.hotelCategory} · ${this.hotelNights} nights`;
    const lines = [
      `✈ Best transfer: ${rec.program}`,
      `Partner: ${rec.partner}`,
      `Route: ${route}`,
      `${pts} pts (~${val} value · ${rec.cpp}¢/pt)`,
      `${rec.note}`,
      '',
      'Found with Tally Points Advisor',
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      this.copiedResult.set(true);
      setTimeout(() => this.copiedResult.set(false), 2000);
    }).catch(() => {/* silent fail */});
  }

  private readonly HOW_TO_BOOK: Record<string, { steps: string[]; url: string }> = {
    'ANA Mileage Club': {
      steps: [
        'Transfer Amex MR → ANA at 1:1 (allow 3–5 business days to post)',
        'Go to anamileageclub.com → Book Award Travel',
        'Enter round-trip route — ANA requires round-trip for partner awards',
        'If online is sold out, call ANA at 1-800-235-9262 and ask for Star Alliance award space',
      ],
      url: 'anamileageclub.com',
    },
    'Turkish Miles&Smiles': {
      steps: [
        'Transfer Citi TY or Capital One → Turkish Airlines Miles&Smiles (1:1)',
        'Go to turkishairlines.com → Miles&Smiles → Search Award Tickets',
        'Tip: Try at midnight Turkey time (UTC+3) — inventory often refreshes then',
        'If online booking fails, call Turkish at 1-800-874-8875 and request the award',
      ],
      url: 'turkishairlines.com/en-us/miles-and-smiles/miles-award-tickets',
    },
    'Air Canada Aeroplan': {
      steps: [
        'Transfer points from any linked program (Amex MR, Chase UR, Cap1, Bilt) at 1:1',
        'Go to aircanada.com or open the Air Canada app',
        'Select "Aeroplan Points" as payment method when searching flights',
        'Aeroplan allows open-jaw and stopovers — mix airlines freely (Star Alliance + partners)',
      ],
      url: 'aircanada.com',
    },
    'Singapore KrisFlyer': {
      steps: [
        'Transfer Amex MR, Chase UR, Citi TY, or Cap1 → KrisFlyer (1:1)',
        'Log in at singaporeair.com → Book with KrisFlyer miles',
        'For Suites class: search 3.5 days before departure — last-minute inventory often drops',
        'No fuel surcharges when booking on Singapore Airlines metal',
      ],
      url: 'singaporeair.com',
    },
    'Virgin Atlantic Flying Club': {
      steps: [
        'Transfer Amex MR, Chase UR, or Citi TY → Virgin Atlantic (1:1)',
        'Log in at virginatlantic.com → Redeem Miles → Flights',
        'For ANA bookings: call Virgin at 1-800-862-8621 (cannot book ANA online)',
        'For Delta One: search on virgin\'s site — online booking works for Delta',
      ],
      url: 'virginatlantic.com',
    },
    'Air France/KLM Flying Blue': {
      steps: [
        'Transfer Amex MR, Chase UR, Citi TY, or Cap1 → Flying Blue (1:1)',
        'Go to airfranceklm.com → Flying Blue → Search Award Tickets',
        'Promo Awards (25–50% off) publish monthly — check on the 1st of each month',
        'No change fees on award tickets — very flexible program',
      ],
      url: 'airfranceklm.com',
    },
    'British Airways Avios': {
      steps: [
        'Transfer Amex MR, Chase UR, or Cap1 → British Airways (1:1)',
        'Go to britishairways.com → Spend Avios → Flights',
        'For AA/Iberia/Alaska metal: pricing is distance-based — calculate at ba.com',
        'Short-haul hops (e.g., ORD→BOS) can cost as little as 4,500 Avios one-way',
      ],
      url: 'britishairways.com',
    },
    'Alaska MileagePlan': {
      steps: [
        'Transfer Bilt → Alaska MileagePlan (1:1) — only Bilt transfers to Alaska',
        'Go to alaskaair.com → Find Award Flights',
        'For Cathay Pacific and JAL: search on alaskaair.com → partner airlines',
        'JAL First/Business awards open 11 days before departure — set a reminder',
      ],
      url: 'alaskaair.com',
    },
    'World of Hyatt': {
      steps: [
        'Transfer Chase UR or Bilt → Hyatt (1:1 — instant transfer)',
        'Go to hyatt.com → Find & Book → Use Points toggle',
        'Book exactly 13 months ahead for best availability at top properties',
        'Park Hyatt and Alila properties have the best CPP in the portfolio',
      ],
      url: 'hyatt.com',
    },
    'Marriott Bonvoy': {
      steps: [
        'Transfer Amex MR, Chase UR, or Bilt → Bonvoy (Amex: 1:3 including a 5K bonus every 60K)',
        'Go to marriott.com → Redeem Points',
        'Always book 5-night stays to get the 5th night free (effective 20% discount)',
        'Off-peak pricing applies — check calendar for cheaper point windows',
      ],
      url: 'marriott.com',
    },
    'Avianca LifeMiles': {
      steps: [
        'Transfer Citi TY or Capital One → Avianca LifeMiles (1:1)',
        'Go to lifemiles.com → Redeem → Flights',
        'Watch for transfer bonuses — Avianca runs them several times per year',
        'Star Alliance Business Class to South America is priced well here',
      ],
      url: 'lifemiles.com',
    },
  };

  getHowToSteps(program: string): string[] {
    return this.HOW_TO_BOOK[program]?.steps ?? [];
  }

  getBookingUrl(program: string): string | null {
    return this.HOW_TO_BOOK[program]?.url ?? null;
  }

  toggleHowTo(program: string): void {
    this.expandedHowTo.update(cur => cur === program ? null : program);
  }

  clearAllTrips(): void {
    if (!this.clearConfirm()) {
      // First tap — enter confirm state, auto-reset after 3s
      this.clearConfirm.set(true);
      if (this._clearConfirmTimer) clearTimeout(this._clearConfirmTimer);
      this._clearConfirmTimer = setTimeout(() => this.clearConfirm.set(false), 3000);
    } else {
      // Second tap — actually clear
      if (this._clearConfirmTimer) clearTimeout(this._clearConfirmTimer);
      this._clearConfirmTimer = null;
      this.clearConfirm.set(false);
      this.trips.clearAll();
    }
  }

  formatTripDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  }
}

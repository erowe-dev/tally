import { Component, ElementRef, ViewChild, signal, computed, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OptimizerService } from '../../core/services/optimizer.service';
import { WalletService } from '../../core/services/wallet.service';
import { DataService } from '../../core/services/data.service';
import { TripsService } from '../../core/services/trips.service';
import { ExpiryService, ExpiryStatus } from '../../core/services/expiry.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { NavigationService } from '../../core/services/navigation.service';
import { SearchesService } from '../../core/services/searches.service';
import { AirportSearchService } from '../../core/services/airport-search.service';
import { ApiService } from '../../core/services/api.service';
import { AwardAvailabilityResult, Recommendation, CabinClass, HotelCategory, SavedSearch, DateFlexibility, SavedTrip } from '../../core/models';
import { SavedTripsComponent } from './saved-trips.component';

interface RouteHistoryEntry {
  tripType: 'flight' | 'hotel';
  fromCity: string; toCity: string; cabin: CabinClass; passengers: number;
  hotelCategory: HotelCategory; hotelNights: number;
  label: string; ts: string;
}

type FlexPreset = 'exact' | 'plus3' | 'plus7' | 'month' | 'next60';
type TripDirection = 'roundtrip' | 'oneway';

interface OptimizerSavedSearch {
  id: string;
  tripType: 'flight' | 'hotel';
  label: string;
  createdAt: string;
  fromCity: string;
  toCity: string;
  cabin: CabinClass;
  passengers: number;
  tripDirection: TripDirection;
  earliestDeparture: string;
  latestReturn: string;
  tripLengthMin: number;
  tripLengthMax: number;
  flexibilityPreset: FlexPreset;
  hotelDest: string;
  hotelCategory: HotelCategory;
  hotelNights: number;
  hotelCheckIn: string;
  hotelCheckOut: string;
  hotelTravelers: number;
  hotelRooms: number;
}

type LiveSearchState = 'idle' | 'needs_date' | 'loading' | 'searching' | 'live_results' | 'no_live_results' | 'source_unavailable' | 'rate_limited' | 'stale_discovery_only' | 'error';

const ROUTE_HISTORY_KEY = 'tally_route_history_v1';
const MAX_ROUTE_HISTORY = 5;
const HOME_AIRPORT_KEY = 'tally_home_airport_v1';
const MAX_SAVED_SEARCHES = 5;
const CABIN_CLASSES = new Set<CabinClass>(['economy', 'premium', 'business', 'first']);
const HOTEL_CATEGORIES = new Set<HotelCategory>(['budget', 'mid', 'luxury', 'top']);

const ROUTE_LABELS: Record<string, string> = {
  transatlantic: 'US ↔ Europe',
  transpacific:  'US ↔ Asia/Pacific',
  hawaii:        'Mainland US ↔ Hawaii',
  domestic:      'US Domestic',
  latin_america: 'US ↔ Latin America',
  caribbean:     'US ↔ Caribbean',
  middle_east:   'US ↔ Middle East',
  africa:        'US ↔ Africa',
  eurasia:       'Europe ↔ Asia',
  default:       'Worldwide',
};

const ROUTE_TIPS: Partial<Record<string, string>> = {
  transatlantic: 'Book transatlantic Business Class 330–355 days out. Most programs open exactly 11 months from departure.',
  transpacific:  'ANA awards require round-trip bookings. Japan award space opens at midnight JST.',
  hawaii:        'Alaska MileagePlan is the best deal for Hawaii (only Bilt transfers). Avios distance-based pricing helps for short Mainland hops.',
  domestic:      'British Airways Avios is distance-based — short hops under 650 miles can be as low as 4,500 Avios.',
  latin_america: 'LifeMiles prices South American routes well. Watch for 30% transfer bonuses from Citi/Cap1.',
  caribbean:     'Avios Web Specials from AA drop Tuesdays. Caribbean routes are often just 15K Avios economy.',
  middle_east:   'Aeroplan books Emirates and Qatar without fuel surcharges. Open-jaw DXB/DOH works on the same ticket.',
  africa:        'Aeroplan prices Star Alliance to Africa without surcharges. Ethiopian Airlines serves most of sub-Saharan Africa.',
  eurasia:       'Turkish Miles&Smiles prices Europe→Asia Star Alliance Business at some of the lowest rates available.',
  default:       'Transfer bonuses can boost your miles by 20–40% — always check before moving any points.',
};

/** Module-level const — no per-instance allocation */
const HOW_TO_BOOK: Record<string, { steps: string[]; url: string }> = {
  'ANA Mileage Club': {
    steps: [
      'Transfer Amex MR → ANA at 1:1 (allow 3–5 business days to post)',
      'Go to anamileageclub.com → Book Award Travel',
      'Enter round-trip route — ANA requires round-trip for partner awards',
      'Call ANA at 1-800-235-9262 for award space not shown online',
    ],
    url: 'anamileageclub.com',
  },
  'Turkish Miles&Smiles': {
    steps: [
      'Transfer Citi TY or Capital One → Turkish Miles&Smiles (1:1)',
      'Go to turkishairlines.com → Miles&Smiles → Search Award Tickets',
      'Try at midnight Turkey time (UTC+3) — inventory often refreshes then',
      'Call Turkish at 1-800-874-8875 if online booking fails',
    ],
    url: 'turkishairlines.com/en-us/miles-and-smiles/miles-award-tickets',
  },
  'Air Canada Aeroplan': {
    steps: [
      'Transfer Amex MR, Chase UR, Cap1, or Bilt → Aeroplan (1:1)',
      'Book at aircanada.com or the Air Canada app',
      'Select "Aeroplan Points" as payment when searching flights',
      'Aeroplan allows open-jaws and stopovers across all Star Alliance carriers',
    ],
    url: 'aircanada.com',
  },
  'Singapore KrisFlyer': {
    steps: [
      'Transfer Amex MR, Chase UR, Citi TY, or Cap1 → KrisFlyer (1:1)',
      'Log in at singaporeair.com → Book with KrisFlyer miles',
      'For Suites: search 3.5 days before departure for last-minute releases',
      'No fuel surcharges when flying Singapore Airlines metal',
    ],
    url: 'singaporeair.com',
  },
  'Virgin Atlantic Flying Club': {
    steps: [
      'Transfer Amex MR, Chase UR, or Citi TY → Virgin Atlantic (1:1)',
      'Log in at virginatlantic.com → Redeem Miles → Flights',
      'For ANA awards: call Virgin at 1-800-862-8621 (online booking unavailable)',
      'For Delta One: search on virgin\'s site — online booking works',
    ],
    url: 'virginatlantic.com',
  },
  'Air France/KLM Flying Blue': {
    steps: [
      'Transfer Amex MR, Chase UR, Citi TY, or Cap1 → Flying Blue (1:1)',
      'Go to airfranceklm.com → Flying Blue → Search Award Tickets',
      'Promo Awards (25–50% off) publish on the 1st of each month',
      'No change fees on award tickets — very flexible program',
    ],
    url: 'airfranceklm.com',
  },
  'British Airways Avios': {
    steps: [
      'Transfer Amex MR, Chase UR, or Cap1 → British Airways (1:1)',
      'Go to britishairways.com → Spend Avios → Flights',
      'Distance-based pricing: short hops can be as low as 4,500 Avios one-way',
      'Works on AA, Iberia, Alaska, and BA metal',
    ],
    url: 'britishairways.com',
  },
  'Alaska MileagePlan': {
    steps: [
      'Transfer Bilt → Alaska MileagePlan (1:1) — only Bilt transfers to Alaska',
      'Search at alaskaair.com → Find Award Flights → partner airlines',
      'Cathay Pacific and JAL: search on Alaska\'s site for partner availability',
      'JAL First/Business opens 11 days before departure — set a reminder',
    ],
    url: 'alaskaair.com',
  },
  'World of Hyatt': {
    steps: [
      'Transfer Chase UR or Bilt → Hyatt (1:1 — instant)',
      'Go to hyatt.com → Find & Book → toggle Use Points',
      'Book 13 months ahead for best availability at top properties',
      'Park Hyatt and Alila properties offer the best CPP',
    ],
    url: 'hyatt.com',
  },
  'Marriott Bonvoy': {
    steps: [
      'Transfer Amex MR, Chase UR, or Bilt → Bonvoy (Amex: 1:3 + 5K bonus per 60K)',
      'Book at marriott.com → Redeem Points',
      'Book 5-night stays to get the 5th night free (20% effective discount)',
      'Off-peak pricing applies — check the calendar for cheaper windows',
    ],
    url: 'marriott.com',
  },
  'Avianca LifeMiles': {
    steps: [
      'Transfer Citi TY or Capital One → Avianca LifeMiles (1:1)',
      'Go to lifemiles.com → Redeem → Flights',
      'Watch for transfer bonuses — Avianca runs them several times per year',
      'Star Alliance Business to South America is priced well here',
    ],
    url: 'lifemiles.com',
  },
  'Aeroplan': {
    steps: [
      'Transfer Amex MR, Chase UR, Capital One, or Bilt → Aeroplan (1:1)',
      'Search at aircanada.com with "Book with points" enabled',
      'Use flexible dates to compare dynamic Air Canada pricing against partner awards',
      'Look for partner awards to avoid fuel surcharges and preserve stopover flexibility',
    ],
    url: 'aircanada.com/ca/en/aco/home/aeroplan.html',
  },
  'United MileagePlus': {
    steps: [
      'Transfer Chase UR or Bilt → United MileagePlus (1:1 — instant)',
      'Find awards at united.com → Find Award Travel',
      'Lufthansa First Class: book 14 days before departure (inventory holds)',
      'United Excursionist Perk: free one-way within a region on round-trips',
    ],
    url: 'united.com/en/us/book/award-travel',
  },
  'American AAdvantage': {
    steps: [
      'Transfer Bilt → AAdvantage (1:1 — instant); only Bilt partners with AA',
      'Book at aa.com → Book Award Travel',
      'Web Special awards (discounted) drop on Tuesdays — check aa.com/awardmaps',
      'For Qantas Business: search "Q class" or call 1-800-882-8880',
    ],
    url: 'aa.com/loyalty/home.do',
  },
  'Southwest Rapid Rewards': {
    steps: [
      'Transfer Chase UR → Southwest Rapid Rewards (1:1)',
      'Book at southwest.com → Reward travel',
      'All fares are bookable with points — price in points tracks cash price',
      'Companion Pass (135K points/year) makes every booking 2-for-1',
    ],
    url: 'southwest.com/rapidrewards/rapid-rewards-member-benefits',
  },
  'Hilton Honors': {
    steps: [
      'Transfer Amex MR → Hilton Honors (1:2 ratio)',
      'Book at hilton.com → toggle Use points',
      'Book 5 nights with points to get the 5th night free (20% discount)',
      'Best value: Conrad and Waldorf properties in aspirational destinations',
    ],
    url: 'hilton.com/en/hilton-honors/redeem',
  },
  'IHG One Rewards': {
    steps: [
      'Transfer Chase UR → IHG One Rewards (1:1)',
      'Book at ihg.com → Pay with points',
      'IHG Premier card annual free night cert is worth $200–400 — use it first',
      'Best value: InterContinental and Kimpton boutique properties',
    ],
    url: 'ihg.com/rewardsclub/gb/en/redeem',
  },
  'Korean Air SkyPass': {
    steps: [
      'Use Korean Air SkyPass miles or search partner space through Korean Air',
      'Log in at koreanair.com → SKYPASS → Redeem Miles',
      'Search Seoul routes first, then add onward partners after confirming long-haul space',
      'Partner awards can require extra documentation, so start early for family bookings',
    ],
    url: 'koreanair.com/skypass',
  },
  'Aeromexico Club Premier': {
    steps: [
      'Transfer from compatible bank or hotel partners only after confirming award space',
      'Search at aeromexico.com → Club Premier reward flights',
      'Compare against Flying Blue and Delta before transferring because pricing can vary widely',
      'Use Aeromexico primarily when SkyTeam availability is better than cash pricing',
    ],
    url: 'aeromexico.com/en-us/club-premier',
  },
};

@Component({
  selector: 'tally-optimizer',
  standalone: true,
  imports: [CommonModule, FormsModule, SavedTripsComponent],
  template: `
    <div class="page-content">
      <div class="section-eyebrow">Transfer Optimizer</div>
      <h2 class="section-title">Find the <em>best use</em><br>of your points</h2>

      <div class="toggle-row">
        <div class="type-toggle" role="radiogroup" aria-label="Trip search type">
          <button type="button" class="toggle-btn" [class.active]="tripType() === 'flight'"
            role="radio"
            [attr.aria-checked]="tripType() === 'flight'"
            (click)="tripType.set('flight')">
            ✈ Flights
          </button>
          <button type="button" class="toggle-btn" [class.active]="tripType() === 'hotel'"
            role="radio"
            [attr.aria-checked]="tripType() === 'hotel'"
            (click)="tripType.set('hotel')">
            🏨 Hotels
          </button>
        </div>
      </div>

      <!-- Flight fields -->
      <div class="fields" *ngIf="tripType() === 'flight'">
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="optimizer-from">From</label>
            <input
              #fromInput
              id="optimizer-from"
              class="field-input"
              [class.invalid]="validationError() && !fromCity.trim()"
              [attr.aria-invalid]="validationError() && !fromCity.trim() ? 'true' : null"
              [(ngModel)]="fromCity"
              placeholder="OMA or Omaha"
              list="optimizer-airports"
              autocomplete="off"
              aria-describedby="airport-search-help"
              (input)="fromCity = normalizeAirportInput(fromCity); clearValidation()">
            <div class="home-airport-hint" *ngIf="homeAirport() || fromCity.length === 3">
              <span class="home-badge" *ngIf="fromCity.length === 3 && fromCity === homeAirport()">📍 Home</span>
              <button type="button" class="home-set-btn" *ngIf="fromCity.length === 3 && fromCity !== homeAirport()"
                (click)="setHomeAirport()" title="Save as your default departure airport" aria-label="Save origin as home airport">📍 Set as home</button>
              <button type="button" class="home-use-btn" *ngIf="homeAirport() && fromCity.length !== 3"
                (click)="useHomeAirport()" [attr.aria-label]="'Use saved home airport ' + homeAirport()">📍 {{ homeAirport() }}</button>
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="optimizer-to">To</label>
            <input
              #toInput
              id="optimizer-to"
              class="field-input"
              [class.invalid]="validationError() && !toCity.trim()"
              [attr.aria-invalid]="validationError() && !toCity.trim() ? 'true' : null"
              [(ngModel)]="toCity"
              placeholder="LHR or London"
              list="optimizer-airports"
              autocomplete="off"
              aria-describedby="airport-search-help"
              (input)="toCity = normalizeAirportInput(toCity); clearValidation()">
          </div>
        </div>
        <datalist id="optimizer-airports">
          <option *ngFor="let airport of airportOptions" [value]="airport.code">
            {{ airport.city }} · {{ airport.name }} · {{ airport.region }}
          </option>
        </datalist>
        <p id="airport-search-help" class="field-note">Start with an airport code or city. Suggestions are bundled for offline use so trip planning still works on the move.</p>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="optimizer-cabin">Cabin</label>
            <select id="optimizer-cabin" class="field-input" [(ngModel)]="cabin">
              <option value="economy">Economy</option>
              <option value="premium">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First Class</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="optimizer-passengers">Passengers</label>
            <select id="optimizer-passengers" class="field-input" [(ngModel)]="passengers">
              <option [ngValue]="1">1 Passenger</option>
              <option [ngValue]="2">2 Passengers</option>
              <option [ngValue]="3">3 Passengers</option>
              <option [ngValue]="4">4 Passengers</option>
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="optimizer-direction">Trip type</label>
            <select id="optimizer-direction" class="field-input" [(ngModel)]="tripDirection">
              <option value="roundtrip">Round-trip</option>
              <option value="oneway">One-way</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="optimizer-flex">Flexibility</label>
            <select id="optimizer-flex" class="field-input" [(ngModel)]="flexibilityPreset">
              <option value="exact">Exact dates</option>
              <option value="plus3">±3 days</option>
              <option value="plus7">±7 days</option>
              <option value="month">Whole month</option>
              <option value="next60">Next 60 days</option>
            </select>
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="optimizer-earliest">Earliest departure</label>
            <input
              #earliestDepartureInput
              id="optimizer-earliest"
              class="field-input"
              type="date"
              [ngModel]="earliestDeparture"
              (input)="onEarliestDepartureChange($any($event.target).value)"
              (change)="onEarliestDepartureChange($any($event.target).value)">
          </div>
          <div class="field">
            <label class="field-label" for="optimizer-latest">Latest return</label>
            <input
              #latestReturnInput
              id="optimizer-latest"
              class="field-input"
              type="date"
              [min]="minLatestReturnDate()"
              [ngModel]="latestReturn"
              (input)="onLatestReturnChange($any($event.target).value)"
              (change)="onLatestReturnChange($any($event.target).value)">
          </div>
        </div>
        <div class="field-row compact-row">
          <div class="field">
            <label class="field-label" for="optimizer-min-nights">Trip length min</label>
            <input #tripLengthMinInput id="optimizer-min-nights" class="field-input" type="number" min="1" max="45" [(ngModel)]="tripLengthMin" (ngModelChange)="clearValidation()">
          </div>
          <div class="field">
            <label class="field-label" for="optimizer-max-nights">Trip length max</label>
            <input #tripLengthMaxInput id="optimizer-max-nights" class="field-input" type="number" min="1" max="60" [(ngModel)]="tripLengthMax" (ngModelChange)="clearValidation()">
          </div>
        </div>
      </div>

      <!-- Hotel fields -->
      <div class="fields" *ngIf="tripType() === 'hotel'">
        <div class="field-row">
          <div class="field full">
            <label class="field-label" for="optimizer-hotel-dest">Destination</label>
            <input
              #hotelDestInput
              id="optimizer-hotel-dest"
              class="field-input"
              [(ngModel)]="hotelDest"
              placeholder="Tokyo, Maldives, Paris..."
              (ngModelChange)="clearValidation()"
              aria-describedby="hotel-destination-help">
          </div>
        </div>
        <p id="hotel-destination-help" class="field-note">Hotel results factor destination context into the planning summary; confirm live room availability and cash rates before transferring points.</p>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="optimizer-checkin">Check-in</label>
            <input
              #hotelCheckInInput
              id="optimizer-checkin"
              class="field-input"
              type="date"
              [ngModel]="hotelCheckIn"
              (input)="onHotelCheckInChange($any($event.target).value)"
              (change)="onHotelCheckInChange($any($event.target).value)">
          </div>
          <div class="field">
            <label class="field-label" for="optimizer-checkout">Check-out</label>
            <input
              #hotelCheckOutInput
              id="optimizer-checkout"
              class="field-input"
              type="date"
              [min]="minHotelCheckOutDate()"
              [ngModel]="hotelCheckOut"
              (input)="onHotelCheckOutChange($any($event.target).value)"
              (change)="onHotelCheckOutChange($any($event.target).value)">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="optimizer-hotel-category">Category</label>
            <select id="optimizer-hotel-category" class="field-input" [(ngModel)]="hotelCategory">
              <option value="budget">Budget (Cat 1–2)</option>
              <option value="mid">Mid-range (Cat 3–4)</option>
              <option value="luxury">Luxury (Cat 5–6)</option>
              <option value="top">Top Tier (Cat 7–8)</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="optimizer-hotel-nights">Nights</label>
            <select id="optimizer-hotel-nights" class="field-input" [(ngModel)]="hotelNights">
              <option [ngValue]="1">1 Night</option>
              <option [ngValue]="3">3 Nights</option>
              <option [ngValue]="5">5 Nights</option>
              <option [ngValue]="7">7 Nights</option>
            </select>
          </div>
        </div>
        <div class="field-row compact-row">
          <div class="field">
            <label class="field-label" for="optimizer-hotel-travelers">Travelers</label>
            <select id="optimizer-hotel-travelers" class="field-input" [(ngModel)]="hotelTravelers">
              <option [ngValue]="1">1 Traveler</option>
              <option [ngValue]="2">2 Travelers</option>
              <option [ngValue]="3">3 Travelers</option>
              <option [ngValue]="4">4 Travelers</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="optimizer-hotel-rooms">Rooms</label>
            <select id="optimizer-hotel-rooms" class="field-input" [(ngModel)]="hotelRooms">
              <option [ngValue]="1">1 Room</option>
              <option [ngValue]="2">2 Rooms</option>
              <option [ngValue]="3">3 Rooms</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Recent searches -->
      <div class="recent-routes" *ngIf="recentRoutes().length > 0">
        <span class="recent-label">Recent</span>
        <div class="recent-chips">
          <button type="button" class="recent-chip" *ngFor="let h of recentRoutes()" (click)="applyHistory(h)"
            [title]="'Re-run: ' + h.label">
            {{ h.tripType === 'flight' ? '✈' : '🏨' }} {{ h.label }}
          </button>
        </div>
      </div>

      <div id="optimizer-validation-error" class="validation-banner" *ngIf="validationError() as error" aria-live="assertive">
        {{ error }}
      </div>

      <button
        type="button"
        class="btn-analyze"
        [class.needs-attention]="validationError()"
        [attr.aria-describedby]="validationError() ? 'optimizer-validation-error' : null"
        (click)="analyze()">
        {{ validationError() ? 'Review inputs' : 'Analyze Transfers →' }}
      </button>

      <div class="ss-actions">
        <button
          class="btn-save-search"
          type="button"
          (click)="saveCurrentSearch()"
          [disabled]="savedSearchLimitReached()"
          [attr.aria-label]="'Save current ' + tripType() + ' search intent'">
          {{ savedSearchLimitReached() ? 'Limit reached' : '☆ Save search' }}
        </button>
        <span class="ss-count" *ngIf="savedSearchCount()">
          {{ savedSearchCount() }}/{{ maxSavedSearches }} saved
        </span>
      </div>

      <div class="ss-panel" *ngIf="savedSearchCount()">
        <div class="ss-head">
          <span class="section-eyebrow">Saved Searches</span>
          <span class="section-eyebrow ss-sync" [class.error]="searches.syncState() === 'error'">
            {{ getSearchSyncLabel() }}
          </span>
        </div>
        <div class="ss-list">
          <div class="ss-item" *ngFor="let search of savedSearches()">
            <button
              class="ss-chip"
              type="button"
              (click)="applySavedSearch(search)"
              [attr.aria-label]="'Re-run saved search ' + search.label">
              <span>{{ search.tripType === 'flight' ? '✈' : '🏨' }}</span>
              <span>{{ search.label }}</span>
            </button>
            <button
              class="ss-del"
              type="button"
              (click)="deleteSavedSearch(search.id)"
              [attr.aria-label]="'Delete saved search ' + search.label">
              ×
            </button>
          </div>
        </div>
        <p class="field-note" *ngIf="savedSearchLimitReached()">
          Delete one saved search to save another.
        </p>
      </div>

      <!-- Quick Wins toggle — only shown when user has wallet data -->
      <button type="button" class="btn-quick-wins" *ngIf="wallet.hasAnyPoints()"
        aria-controls="optimizer-quick-wins"
        [attr.aria-expanded]="showQuickWins()"
        (click)="toggleQuickWins()">
        {{ showQuickWins() ? '✕ Hide' : '⚡ What can I book now?' }}
      </button>

      <!-- Quick Wins panel -->
      <div id="optimizer-quick-wins" class="quick-wins-panel" *ngIf="showQuickWins()">
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
        <div class="qw-empty" *ngIf="quickWins().length === 0" aria-live="polite">
          <p>Your balances don't yet cover any individual redemption. Keep earning!</p>
        </div>
      </div>

      <!-- Empty state -->
      <div class="empty-state" *ngIf="!results().length && !analyzed() && !showQuickWins()">
        <div class="empty-icon">⚡</div>
        <p>Enter your trip details<br>to see the best transfers</p>
        <!-- Quick destination chips (shown when home airport is set) -->
        <div class="quick-dest-section" *ngIf="homeAirport() && tripType() === 'flight'">
          <div class="qd-label">Popular routes from {{ homeAirport() }}</div>
          <div class="qd-chips">
            <button type="button" *ngFor="let d of quickDestinations()" class="qd-chip"
              (click)="applyQuickDest(d)">
              {{ d.flag }} {{ d.to }} <span class="qd-type">{{ d.label }}</span>
            </button>
          </div>
        </div>
        <!-- Wallet-aware suggestion: surfaces when user has points -->
        <div class="wallet-hint" *ngIf="walletSuggestion() as hint">
          <div class="wh-label">Suggested for your wallet</div>
          <button type="button" class="wh-card" (click)="applyWalletSuggestion(hint)">
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
      <section class="live-results" *ngIf="analyzed() && tripType() === 'flight'" aria-labelledby="live-results-title">
        <div class="live-head">
          <div>
            <span class="section-eyebrow" id="live-results-title">Live Award Results</span>
            <h3>{{ getLiveSearchTitle() }}</h3>
          </div>
          <span class="live-status" [class.live]="liveSearchState() === 'live_results'">
            {{ getLiveSearchStatusLabel() }}
          </span>
        </div>

        <div class="live-message" *ngIf="liveSearchState() !== 'live_results'" aria-live="polite">
          {{ getLiveSearchMessage() }}
        </div>

        <div class="live-card" *ngFor="let award of liveAwardResults()">
          <div class="live-main">
            <div>
              <div class="live-program">{{ award.program }}</div>
              <div class="live-route">
                {{ award.originAirport }}→{{ award.destinationAirport }} · {{ award.cabin }} · {{ formatDateLabel(award.departureDate) }}
              </div>
            </div>
            <div class="live-price">
              {{ award.points | number }}
              <small>pts verified</small>
            </div>
          </div>
          <div class="live-meta">
            <span>{{ award.source }}</span>
            <span *ngIf="award.seatCount">{{ award.seatCount }} seat{{ award.seatCount === 1 ? '' : 's' }}</span>
            <span>Checked {{ formatCheckedAt(award.checkedAt) }}</span>
          </div>
          <a *ngIf="award.bookingUrl" class="live-book" [href]="award.bookingUrl" target="_blank" rel="noopener noreferrer"
            [attr.aria-label]="'Open booking site for ' + award.program">
            Open booking site
          </a>
        </div>
      </section>

      <div class="results" *ngIf="results().length">
        <div class="results-header">
          <div>
            <span class="section-eyebrow">{{ filteredResults().length }} of {{ results().length }} Strategy Options</span>
            <span class="route-label" *ngIf="routeLabel()">{{ routeLabel() }}</span>
            <span class="route-unrecognized" *ngIf="showUnrecognizedNote()">
              ℹ Airport codes not in our database — showing worldwide recommendations
            </span>
          </div>
          <button class="related-spots-btn" type="button" (click)="openRelatedSweetSpots()">
            Find related sweet spots →
          </button>
        </div>

        <section class="strategy-summary" aria-labelledby="strategy-summary-title">
          <div>
            <span class="section-eyebrow" id="strategy-summary-title">Strategy Summary</span>
            <h3>{{ strategySummary().title }}</h3>
          </div>
          <div class="strategy-grid">
            <div class="strategy-item">
              <span>Route type</span>
              <strong>{{ strategySummary().route }}</strong>
            </div>
            <div class="strategy-item">
              <span>Typical points</span>
              <strong>{{ strategySummary().pointsBand }}</strong>
            </div>
            <div class="strategy-item">
              <span>Date window</span>
              <strong>{{ strategySummary().dateWindow }}</strong>
            </div>
            <div class="strategy-item">
              <span>Wallet coverage</span>
              <strong>{{ strategySummary().coverage }}</strong>
            </div>
          </div>
          <p class="strategy-note">{{ strategySummary().expiryRisk }}</p>
        </section>

        <!-- Result filters (only when user has a wallet) -->
        <div class="result-filters" *ngIf="wallet.hasAnyPoints()" role="group" aria-label="Result filters and sort">
          <button type="button" class="rf-btn" [class.active]="canAffordOnly()"
            [attr.aria-pressed]="canAffordOnly()"
            (click)="canAffordOnly.set(!canAffordOnly())">
            ✓ Can afford
          </button>
          <div class="rf-sort" role="radiogroup" aria-label="Result sort">
            <button type="button" class="rf-btn" [class.active]="sortBy() === 'cpp'"
              role="radio"
              [attr.aria-checked]="sortBy() === 'cpp'"
              (click)="sortBy.set('cpp')">Best CPP</button>
            <button type="button" class="rf-btn" [class.active]="sortBy() === 'coverage'"
              role="radio"
              [attr.aria-checked]="sortBy() === 'coverage'"
              (click)="sortBy.set('coverage')">My Coverage</button>
          </div>
        </div>

        <div class="no-affordable" *ngIf="canAffordOnly() && filteredResults().length === 0" aria-live="polite">
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
                <span class="covered-badge" *ngIf="wallet.canCover(rec.cards, rec.ptsRequired ?? rec.ptsBase)">✓</span>
                <span class="already-saved-badge" *ngIf="isAlreadySaved(rec.program)">★ Saved</span>
              </div>
              <div class="rc-partner">{{ rec.partner }}</div>
              <div class="rc-note">{{ rec.note }}</div>
            </div>
            <div class="rc-pts">
              {{ (rec.ptsRequired ?? rec.ptsBase) | number }}
              <small>typical pts</small>
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
              [class.covered]="wallet.canCover(rec.cards, rec.ptsRequired ?? rec.ptsBase)">
              {{ getBestBalance(rec) | number }}
              <span class="rc-cov-sep">/</span>
              {{ (rec.ptsRequired ?? rec.ptsBase) | number }} pts
            </span>
          </div>
          <!-- Points gap nudge: shown when user has partial coverage but not full -->
          <div class="rc-gap-row" *ngIf="getPointsGap(rec) as gap">
            <span class="rc-gap-icon">⚡</span>
            <span class="rc-gap-text">
              {{ gap | number }} more pts to unlock
              <span class="rc-gap-hint">· earn via top spend category on a linked card</span>
            </span>
          </div>
          <!-- Expiry cross-reference: warn when a linked program's points are at risk -->
          <div class="rc-expiry-warn" *ngIf="getExpiryWarning(rec) as exp"
            [class.critical]="exp.urgency === 'critical' || exp.urgency === 'expired'">
            <span class="rce-icon">{{ exp.urgency === 'expired' ? '🚨' : exp.urgency === 'critical' ? '⚠️' : '🔔' }}</span>
            <span class="rce-text">
              <strong>{{ exp.programName }}</strong>
              {{ exp.urgency === 'expired' ? 'points have expired.' :
                 'points expire in ' + exp.daysRemaining + ' day' + (exp.daysRemaining === 1 ? '' : 's') + '.' }}
              Transfer or redeem soon.
            </span>
          </div>

          <div class="rc-chips">
            <span class="chip" *ngFor="let cid of rec.cards">{{ getShort(cid) }}</span>
          </div>
          <div class="best-badge" *ngIf="i === 0">BEST VALUE</div>

          <div class="card-action-row">
            <button type="button" class="save-btn" (click)="saveTrip(rec)" [class.saved]="justSaved() === rec.program">
              {{ justSaved() === rec.program ? '✓ Saved' : '+ Save' }}
            </button>
            <button type="button" class="copy-btn" *ngIf="i === 0"
              (click)="copyTopResult(rec)" [class.copied]="copiedResult()">
              {{ copiedResult() ? '✓ Copied' : '📋 Share' }}
            </button>
            <button type="button" class="howto-btn" *ngIf="getHowToSteps(rec.program).length > 0"
              (click)="toggleHowTo(rec.program)"
              [class.open]="expandedHowTo() === rec.program"
              [attr.aria-controls]="howToPanelId(rec.program)"
              [attr.aria-expanded]="expandedHowTo() === rec.program">
              {{ expandedHowTo() === rec.program ? 'Hide steps' : 'How to book' }}
            </button>
          </div>
          <!-- How-to panel -->
          <div class="howto-panel" [id]="howToPanelId(rec.program)" *ngIf="expandedHowTo() === rec.program">
            <ol class="howto-steps">
              <li *ngFor="let step of getHowToSteps(rec.program)">{{ step }}</li>
            </ol>
            <a *ngIf="getBookingUrl(rec.program) as url"
              class="howto-link" [href]="'https://' + url" target="_blank" rel="noopener noreferrer"
              [attr.aria-label]="'Open booking guidance for ' + rec.program">
              🌐 {{ url }}
            </a>
          </div>
        </div>

        <p class="disclaimer">
          Strategy options are planning guidance, not live award prices. Use verified live results before transferring points.
          Add balances in Wallet for coverage indicators.
        </p>

        <!-- Route-specific insider tip -->
        <div class="route-tip" *ngIf="routeTip()">
          <span class="rt-icon">💡</span>
          <span class="rt-text">{{ routeTip() }}</span>
        </div>
      </div>

      <!-- No results state -->
      <div class="no-results" *ngIf="analyzed() && !results().length">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-title">No matches found</div>
        <p>Try a different route or relax your cabin preference. Our data covers major international routes.</p>
      </div>

      <tally-saved-trips (reanalyze)="reanalyzeTrip($event)" />
    </div>
  `,
  styles: [`
    .toggle-row { margin-bottom: 20px; }
    .type-toggle {
      display: grid; grid-template-columns: 1fr 1fr;
      width: 100%;
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
      padding: 10px 14px;
      cursor: pointer;
      transition: all 0.18s;
    }
    .toggle-btn.active { background: var(--tally-green); color: white; }

    .fields { margin-bottom: 14px; }
    .field-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px; }
    .field-row.compact-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field.full { grid-column: 1/-1; }
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
      box-sizing: border-box; transition: border-color 0.15s; -webkit-appearance: none;
    }
    .field-input:focus { border-color: var(--tally-green); }
    .field-input.invalid { border-color: var(--tally-red); background: var(--tally-red-light); }
    .field-input::placeholder { color: var(--text3); font-weight: 400; }
    select.field-input option { background: var(--white); color: var(--text); }
    .field-note {
      margin: -2px 0 12px;
      font-family: 'Geist Mono', monospace;
      font-size: 10px;
      color: var(--text3);
      line-height: 1.45;
    }
    .home-airport-hint {
      display: flex; align-items: center; margin-top: 5px; min-height: 18px;
    }
    .home-badge {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.1em; color: var(--tally-green); font-weight: 500;
    }
    .home-set-btn {
      background: none; border: none; padding: 8px 0;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.08em; color: var(--text3);
      cursor: pointer; transition: color 0.15s;
    }
    .home-set-btn:hover { color: var(--tally-green); }
    .home-use-btn {
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.25);
      border-radius: 20px; padding: 8px 10px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.08em; color: var(--tally-green);
      cursor: pointer; transition: all 0.15s;
    }
    .home-use-btn:hover { background: rgba(26,122,74,0.12); border-color: var(--tally-green); }

    .btn-analyze {
      width: 100%; background: var(--tally-green); color: white;
      border: none; border-radius: 12px;
      font-family: 'Geist', sans-serif; font-size: 14px; font-weight: 600;
      letter-spacing: 0.02em; padding: 15px;
      cursor: pointer; margin-bottom: 4px;
      transition: opacity 0.15s, transform 0.1s;
    }
    .btn-analyze.needs-attention { background: var(--tally-amber); }
    .btn-analyze:active { transform: scale(0.98); opacity: 0.9; }
    .validation-banner {
      margin: 4px 0 10px;
      background: var(--tally-amber-light);
      border: 1px solid rgba(180,83,9,0.24);
      border-radius: 10px;
      padding: 10px 12px;
      color: var(--tally-amber);
      font-family: 'Geist Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.04em;
      line-height: 1.45;
    }

    .ss-actions {
      display: flex; align-items: center; justify-content: space-between;
      gap: 10px; margin: 8px 0 12px;
    }
    .btn-save-search {
      min-height: 44px; flex: 1;
      background: var(--white); color: var(--tally-green);
      border: 1.5px solid var(--border2); border-radius: 12px;
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-save-search:disabled {
      cursor: not-allowed; opacity: 0.62; color: var(--text3); background: var(--surface);
    }
    .btn-save-search:hover,
    .btn-save-search:focus-visible {
      border-color: var(--tally-green); background: var(--tally-green-light);
      outline: none;
    }
    .ss-count {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); white-space: nowrap;
    }
    .ss-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 14px; padding: 12px; margin-bottom: 12px;
    }
    .ss-head { margin-bottom: 8px; }
    .ss-sync.error { color: var(--tally-red); }
    .ss-list { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
    .ss-item {
      display: inline-flex; flex: 0 0 auto;
      border: 1px solid var(--border); border-radius: 999px; background: var(--white);
      overflow: hidden;
    }
    .ss-chip,.ss-del { min-height: 44px; background: transparent; border: 0; cursor: pointer; }
    .ss-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 12px; flex: 0 1 auto;
      max-width: min(68vw, 360px);
      color: var(--text); font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.03em;
    }
    .ss-chip span:last-child {
      min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .ss-del {
      min-width: 44px; border-left: 1px solid var(--border);
      color: var(--text3); font-size: 18px; line-height: 1;
    }

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
    .quick-dest-section { margin-top: 18px; text-align: left; }
    .qd-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.14em; text-transform: uppercase;
      color: var(--text3); margin-bottom: 8px;
    }
    .qd-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .qd-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--white); border: 1.5px solid var(--border2);
      border-radius: 20px; padding: 8px 12px;
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 500;
      color: var(--text); cursor: pointer;
      transition: all 0.15s; -webkit-tap-highlight-color: transparent;
    }
    .qd-chip:hover { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }
    .qd-type {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.06em; color: var(--text3);
    }
    .qd-chip:hover .qd-type { color: var(--tally-green); opacity: 0.8; }

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
    .wh-sub { font-size: 11px; color: var(--tally-green-mid); line-height: 1.4; }
    .wh-arrow { font-size: 16px; color: var(--tally-green); flex-shrink: 0; }

    .results-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 24px; margin-bottom: 12px; gap: 10px; flex-wrap: wrap;
    }
    .live-results {
      margin: 24px 0 16px;
      padding: 16px;
      border: 1px solid var(--border);
      background: var(--surface);
      border-radius: 8px;
    }
    .live-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 12px; margin-bottom: 12px;
    }
    .live-head h3 {
      margin: 4px 0 0;
      font-family: 'Instrument Serif', serif;
      font-size: 22px;
      font-weight: 400;
      color: var(--text);
    }
    .live-status {
      font-family: 'Geist Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      color: var(--text3);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 5px 7px;
      white-space: nowrap;
    }
    .live-status.live {
      color: var(--tally-green);
      background: var(--tally-green-light);
      border-color: color-mix(in srgb, var(--tally-green) 25%, var(--border));
    }
    .live-message {
      color: var(--text2);
      font-size: 13px;
      line-height: 1.5;
    }
    .live-card {
      background: var(--off);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }
    .live-card + .live-card { margin-top: 10px; }
    .live-main {
      display: flex; justify-content: space-between; gap: 12px;
    }
    .live-program {
      font-weight: 650;
      color: var(--text);
      font-size: 14px;
    }
    .live-route {
      margin-top: 3px;
      font-size: 12px;
      color: var(--text2);
    }
    .live-price {
      font-family: 'Geist Mono', monospace;
      color: var(--tally-green);
      text-align: right;
      font-size: 18px;
      font-weight: 700;
      white-space: nowrap;
    }
    .live-price small {
      display: block;
      color: var(--text3);
      font-size: 9px;
      font-weight: 500;
      text-transform: uppercase;
    }
    .live-meta {
      display: flex; flex-wrap: wrap; gap: 8px;
      margin-top: 10px;
      font-family: 'Geist Mono', monospace;
      font-size: 10px;
      color: var(--text3);
      text-transform: uppercase;
    }
    .live-book {
      display: inline-flex;
      margin-top: 10px;
      color: var(--tally-green);
      font-size: 12px;
      font-weight: 650;
      text-decoration: none;
    }
    .related-spots-btn {
      border: 1px solid var(--border); border-radius: 999px;
      background: var(--white); color: var(--tally-green);
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.04em; padding: 9px 12px; cursor: pointer;
    }
    .related-spots-btn:hover,
    .related-spots-btn:focus-visible {
      border-color: var(--tally-green); background: var(--tally-green-light);
      outline: none;
    }

    .result-filters {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .rf-sort { display: flex; gap: 4px; margin-left: auto; }
    .rf-btn {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 20px; padding: 8px 12px;
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
    .route-unrecognized {
      display: block; font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--tally-amber); letter-spacing: 0.05em; margin-top: 2px;
    }

    .strategy-summary {
      background: linear-gradient(135deg, var(--tally-green-light), var(--surface));
      border: 1px solid rgba(26,122,74,0.22);
      border-radius: 16px; padding: 14px; margin-bottom: 12px;
    }
    .strategy-summary h3 {
      margin: 3px 0 12px;
      font-family: 'Instrument Serif', serif; font-size: 22px; line-height: 1;
      color: var(--text);
    }
    .strategy-grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px; margin-bottom: 10px;
    }
    .strategy-item {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 12px; padding: 10px;
    }
    .strategy-item span {
      display: block; font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.1em; text-transform: uppercase; color: var(--text3);
      margin-bottom: 4px;
    }
    .strategy-item strong {
      display: block; font-size: 12px; color: var(--text); line-height: 1.35;
    }
    .strategy-note {
      margin: 0; font-size: 12px; color: var(--text2); line-height: 1.45;
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

    .rc-top { display: flex; gap: 12px; margin-bottom: 12px; min-width: 0; }
    .rc-left { flex: 1; min-width: 0; }
    .rc-program {
      font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px;
      overflow-wrap: anywhere;
    }
    .covered-badge {
      display: inline-block; margin-left: 6px;
      color: var(--tally-green); font-size: 12px; font-weight: 700;
    }
    .already-saved-badge {
      display: inline-block; margin-left: 6px;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--tally-amber); letter-spacing: 0.06em;
    }
    .rc-partner { font-size: 11px; color: var(--text2); margin-bottom: 2px; }
    .rc-note { font-size: 11px; color: var(--text3); font-style: italic; overflow-wrap: anywhere; }
    .rc-pts {
      text-align: right; flex-shrink: 0;
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

    .rc-gap-row {
      display: flex; align-items: flex-start; gap: 6px;
      margin-top: 4px; margin-bottom: 4px;
      padding: 5px 8px;
      background: rgba(217,119,6,0.06); border-radius: 7px;
      border-left: 2px solid var(--tally-amber);
    }
    .rc-gap-icon { font-size: 11px; flex-shrink: 0; line-height: 1.4; }
    .rc-gap-text {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--tally-amber); line-height: 1.45;
    }
    .rc-gap-hint { color: var(--text3); }

    .rc-expiry-warn {
      display: flex; align-items: flex-start; gap: 6px;
      margin-top: 4px; margin-bottom: 4px;
      padding: 5px 8px; border-radius: 7px;
      background: rgba(217,119,6,0.06);
      border-left: 2px solid var(--tally-amber);
    }
    .rc-expiry-warn.critical {
      background: rgba(220,38,38,0.06);
      border-left-color: var(--tally-red);
    }
    .rce-icon { font-size: 11px; flex-shrink: 0; line-height: 1.45; }
    .rce-text {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--tally-amber); line-height: 1.45;
    }
    .rc-expiry-warn.critical .rce-text { color: var(--tally-red); }

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
      display: inline-flex; align-items: center; margin-top: 10px;
      background: var(--tally-green); color: white;
      font-family: 'Geist Mono', monospace; font-size: 8px;
      letter-spacing: 0.12em; padding: 3px 7px; border-radius: 4px;
    }

    .disclaimer {
      font-family: 'Geist Mono', monospace; font-size: 10px;
      color: var(--text3); line-height: 1.6;
      letter-spacing: 0.05em; margin-top: 12px;
    }
    .route-tip {
      display: flex; align-items: flex-start; gap: 8px;
      grid-column: 1/-1;
      margin-top: 10px; padding: 10px 12px;
      background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.15);
      border-radius: 10px;
    }
    .rt-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
    .rt-text { font-size: 11px; color: var(--tally-green-mid); line-height: 1.55; }

    .card-action-row { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }

    .howto-btn, .save-btn, .copy-btn {
      background: none; border: 1px solid var(--border2); border-radius: 8px;
      color: var(--text3); font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.06em; padding: 8px 10px; cursor: pointer;
      transition: all 0.15s;
    }
    .howto-btn {
      margin-left: auto;
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
      text-decoration: none; margin-top: 4px; max-width: 100%;
      overflow-wrap: anywhere; word-break: break-word;
    }
    .save-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .save-btn.saved { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }
    .copy-btn:hover { border-color: var(--tally-green); color: var(--tally-green); }
    .copy-btn.copied { border-color: var(--tally-green); color: var(--tally-green); background: var(--tally-green-light); }

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
      border-radius: 20px; padding: 8px 11px;
      font-family: 'Geist Mono', monospace; font-size: 10px;
      letter-spacing: 0.03em; color: var(--text2); cursor: pointer;
      transition: all 0.15s; white-space: nowrap;
    }
    .recent-chip:hover {
      border-color: var(--tally-green); color: var(--tally-green);
      background: var(--tally-green-light);
    }

    @media (max-width: 560px) {
      .field-row,
      .field-row.compact-row {
        grid-template-columns: 1fr;
      }
      .rf-sort { width: 100%; margin-left: 0; }
      .rf-btn { flex: 1; }
      .card-action-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .card-action-row>:last-child:nth-child(odd) { grid-column: 1/-1; }
      .howto-btn,
      .save-btn,
      .copy-btn {
        width: 100%;
        margin-left: 0;
      }
    }

    @media (max-width: 430px) {
      .strategy-grid {
        grid-template-columns: 1fr;
      }
      .field-note { font-size: 9px; }
      .result-filters { align-items: stretch; }
      .related-spots-btn,
      .btn-save-search,
      .ss-chip,
      .rf-btn {
        min-height: 44px;
      }
      .ss-list { flex-direction: column; overflow: visible; }
      .ss-item { width: 100%; border-radius: 12px; }
      .ss-chip { max-width: none; flex: 1; justify-content: flex-start; }
      .rc-top { align-items: flex-start; flex-wrap: wrap; }
      .rc-pts { width: 100%; text-align: left; }
      .rc-pts small, .rc-cash { text-align: left; }
      .rc-coverage {
        display: grid;
        grid-template-columns: 1fr;
        gap: 5px;
      }
      .rc-cov-label {
        white-space: normal;
        overflow-wrap: anywhere;
      }
    }
  `]
})
export class OptimizerComponent implements OnChanges {
  @Input() prefill: { fromCity?: string; toCity?: string; cabin?: string } | null = null;
  @ViewChild('fromInput') private fromInput?: ElementRef<HTMLInputElement>;
  @ViewChild('toInput') private toInput?: ElementRef<HTMLInputElement>;
  @ViewChild('earliestDepartureInput') private earliestDepartureInput?: ElementRef<HTMLInputElement>;
  @ViewChild('latestReturnInput') private latestReturnInput?: ElementRef<HTMLInputElement>;
  @ViewChild('tripLengthMinInput') private tripLengthMinInput?: ElementRef<HTMLInputElement>;
  @ViewChild('tripLengthMaxInput') private tripLengthMaxInput?: ElementRef<HTMLInputElement>;
  @ViewChild('hotelDestInput') private hotelDestInput?: ElementRef<HTMLInputElement>;
  @ViewChild('hotelCheckInInput') private hotelCheckInInput?: ElementRef<HTMLInputElement>;
  @ViewChild('hotelCheckOutInput') private hotelCheckOutInput?: ElementRef<HTMLInputElement>;
  private optimizer = inject(OptimizerService);
  private data = inject(DataService);
  wallet = inject(WalletService);
  trips = inject(TripsService);
  private expiry = inject(ExpiryService);
  private analytics = inject(AnalyticsService);
  private nav = inject(NavigationService);
  searches = inject(SearchesService);
  private airportSearch = inject(AirportSearchService);
  private api = inject(ApiService);

  tripType = signal<'flight' | 'hotel'>('flight');
  fromCity = '';
  toCity = '';
  cabin: CabinClass = 'business';
  passengers = 1;
  tripDirection: TripDirection = 'roundtrip';
  earliestDeparture = '';
  latestReturn = '';
  tripLengthMin = 5;
  tripLengthMax = 10;
  flexibilityPreset: FlexPreset = 'plus7';
  hotelDest = '';
  hotelCategory: HotelCategory = 'mid';
  hotelNights = 5;
  hotelCheckIn = '';
  hotelCheckOut = '';
  hotelTravelers = 2;
  hotelRooms = 1;

  results = signal<Recommendation[]>([]);
  liveAwardResults = signal<AwardAvailabilityResult[]>([]);
  liveSearchState = signal<LiveSearchState>('idle');
  liveSearchMessage = signal('');
  analyzed = signal(false);
  validationError = signal<string | null>(null);
  maxCpp = signal(1);
  routeLabel = signal<string>('');
  private routeCategory = signal<string>('default');
  // Briefly highlights the save button after saving
  justSaved = signal<string | null>(null);
  // Briefly highlights the copy button after copying
  copiedResult = signal(false);
  // Filters / sorting for results
  canAffordOnly = signal(false);
  sortBy = signal<'cpp' | 'coverage'>('cpp');
  // Quick Wins panel
  showQuickWins = signal(false);
  // Tracks which result card has the "How to Book" panel open
  expandedHowTo = signal<string | null>(null);
  private _allRecs = this.optimizer.getAllRecs();
  // Route history
  private _routeHistory = signal<RouteHistoryEntry[]>(this.loadRouteHistory());
  private liveSearchRequestSeq = 0;
  readonly recentRoutes = this._routeHistory.asReadonly();
  readonly savedSearches = computed<OptimizerSavedSearch[]>(() =>
    this.searches.searches().slice(0, MAX_SAVED_SEARCHES).map(search => this.toOptimizerSavedSearch(search)),
  );
  readonly savedSearchCount = computed(() => this.searches.searches().length);
  readonly savedSearchLimitReached = computed(() => this.savedSearchCount() >= MAX_SAVED_SEARCHES);
  readonly maxSavedSearches = MAX_SAVED_SEARCHES;
  readonly airportOptions = this.airportSearch.airports();
  // Home airport preference
  private _homeAirport = signal<string>('');
  readonly homeAirport = this._homeAirport.asReadonly();

  constructor() {
    const stored = this._loadHomeAirport();
    this._homeAirport.set(stored);
    if (stored && !this.fromCity) this.fromCity = stored;
  }

  readonly quickWins = computed(() => {
    return this._allRecs.filter(r =>
      this.wallet.canCover(r.cards, r.ptsRequired ?? r.ptsBase)
    );
  });

  readonly filteredResults = computed<Recommendation[]>(() => {
    let recs = this.results();
    if (this.canAffordOnly() && this.wallet.hasAnyPoints()) {
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

  /** Route-specific insider tip shown below results */
  readonly routeTip = computed((): string | null => {
    if (!this.analyzed() || !this.results().length) return null;
    const label = this.routeLabel();
    for (const [key, lbl] of Object.entries(ROUTE_LABELS)) {
      if (lbl === label) return ROUTE_TIPS[key] ?? null;
    }
    return ROUTE_TIPS['default'] ?? null;
  });

  /** True when user entered airport codes but they didn't match any route category */
  readonly showUnrecognizedNote = computed(() => {
    if (this.tripType() !== 'flight') return false;
    if (!this.analyzed() || !this.results().length) return false;
    const from = this.fromCity.trim().toUpperCase();
    const to   = this.toCity.trim().toUpperCase();
    if (!from || !to) return false;
    return !this.routeLabel() || this.routeLabel() === 'Worldwide';
  });

  readonly strategySummary = computed(() => {
    const recs = this.results();
    const pointsBand = this.getPointsBand(recs);
    const coverage = this.getBestCoverageLabel(recs);
    const route = this.tripType() === 'flight'
      ? (this.routeLabel() || ROUTE_LABELS[this.routeCategory()] || 'Worldwide')
      : this.getHotelStrategyRoute();
    return {
      title: this.tripType() === 'flight' ? 'How to search this award window' : 'How to frame this hotel search',
      route,
      pointsBand,
      dateWindow: this.tripType() === 'flight' ? this.getFlightDateWindowSummary() : this.getHotelDateWindowSummary(),
      coverage,
      expiryRisk: this.getStrategyExpiryNote(recs),
    };
  });

  analyze(): void {
    this.normalizePlanningInputs();
    const error = this.getValidationError();
    this.validationError.set(error);
    if (error) {
      this.results.set([]);
      this.liveAwardResults.set([]);
      this.liveSearchState.set('idle');
      this.liveSearchMessage.set('');
      this.analyzed.set(false);
      queueMicrotask(() => this.focusInvalidField(error));
      return;
    }

    let recs: Recommendation[];
    if (this.tripType() === 'flight') {
      const result = this.optimizer.getFlightRecs(this.fromCity, this.toCity, this.cabin, this.passengers);
      recs = result.recs;
      this.routeCategory.set(result.category);
      this.routeLabel.set(ROUTE_LABELS[result.category] ?? '');
    } else {
      this.syncHotelNightsFromDates();
      recs = this.optimizer.getHotelRecs(this.hotelCategory, this.hotelNights);
      this.routeCategory.set(this.hotelCategory);
      this.routeLabel.set('');
    }
    this.maxCpp.set(recs[0]?.cpp ?? 1);
    this.results.set(recs);
    this.analyzed.set(true);
    this.runLiveAwardSearch();
    this.pushToHistory();
    try { localStorage.setItem('tally_optimizer_used', '1'); } catch {}
    this.analytics.track('optimizer_search', {
      trip_type: this.tripType(),
      route_category: this.routeCategory(),
      result_count: recs.length,
    });

    const top = recs[0];
    if (top) {
      this.analytics.track('transfer_calculated', {
        source_card: top.cards[0] ?? 'unknown',
        partner: top.program,
        points_required: top.ptsRequired ?? top.ptsBase,
      });
    }
  }

  clearValidation(): void {
    if (this.validationError()) this.validationError.set(null);
  }

  private runLiveAwardSearch(): void {
    this.liveSearchRequestSeq += 1;
    const requestSeq = this.liveSearchRequestSeq;
    this.liveAwardResults.set([]);
    this.liveSearchMessage.set('');

    if (this.tripType() !== 'flight') {
      this.liveSearchState.set('idle');
      return;
    }

    if (!this.earliestDeparture) {
      this.liveSearchState.set('needs_date');
      this.liveSearchMessage.set('Add a departure date to check current bookable award prices. Strategy guidance can still help you plan before dates are firm.');
      return;
    }

    this.liveSearchState.set('loading');
    this.api.searchAwardAvailability({
      originAirport: this.normalizeAirportInput(this.fromCity),
      destinationAirport: this.normalizeAirportInput(this.toCity),
      startDate: this.earliestDeparture,
      endDate: this.tripDirection === 'roundtrip' ? this.latestReturn : '',
      cabin: this.cabin,
      passengers: this.passengers,
    }).subscribe({
      next: response => {
        if (requestSeq !== this.liveSearchRequestSeq) return;
        const liveResults = response.results.filter(result => result.isLive && result.verificationStatus === 'verified_live');
        this.liveAwardResults.set(liveResults);
        this.liveSearchState.set(liveResults.length > 0 ? 'live_results' : response.status);
        this.liveSearchMessage.set(response.message || response.notice || '');
      },
      error: error => {
        if (requestSeq !== this.liveSearchRequestSeq) return;
        const status = error?.status === 429 ? 'rate_limited' : 'error';
        this.liveSearchState.set(status);
        this.liveSearchMessage.set(status === 'rate_limited'
          ? 'Live search is rate limited. Wait a minute and try again.'
          : 'Live award search is unavailable right now. Strategy guidance is still shown below.');
      },
    });
  }

  getLiveSearchTitle(): string {
    return this.liveSearchState() === 'live_results'
      ? 'Verified bookable prices'
      : 'Current availability check';
  }

  getLiveSearchStatusLabel(): string {
    switch (this.liveSearchState()) {
      case 'loading': return 'Searching';
      case 'live_results': return 'Verified';
      case 'needs_date': return 'Needs dates';
      case 'source_unavailable': return 'No source';
      case 'rate_limited': return 'Limited';
      case 'stale_discovery_only': return 'Stale only';
      case 'no_live_results': return 'No live seats';
      case 'error': return 'Unavailable';
      default: return 'Ready';
    }
  }

  getLiveSearchMessage(): string {
    if (this.liveSearchMessage()) return this.liveSearchMessage();
    switch (this.liveSearchState()) {
      case 'loading':
        return 'Checking configured compliant award sources and verifying candidates before showing prices.';
      case 'source_unavailable':
        return 'No compliant live award data source is configured yet, so Tally is not showing bookable prices.';
      case 'no_live_results':
        return 'No currently verified bookable award availability was found for this route and date.';
      case 'stale_discovery_only':
        return 'Tally found discovery data but could not verify it live, so it is hidden from bookable results.';
      case 'needs_date':
        return 'Add a departure date to check current bookable award prices.';
      case 'rate_limited':
        return 'Live search is rate limited. Wait a minute and try again.';
      case 'error':
        return 'Live award search is unavailable right now. Strategy guidance is still shown below.';
      default:
        return '';
    }
  }

  formatCheckedAt(value: string): string {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'just now';
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  formatDateLabel(value: string): string {
    if (!value) return 'flexible dates';
    const date = this.localDateValue(value);
    if (!date) return value;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  onEarliestDepartureChange(value: string): void {
    this.earliestDeparture = value;
    this.ensureLatestReturnAfterDeparture();
    this.clearValidation();
  }

  onLatestReturnChange(value: string): void {
    this.latestReturn = value;
    this.ensureLatestReturnAfterDeparture();
    this.clearValidation();
  }

  minLatestReturnDate(): string | null {
    return this.nextDateString(this.earliestDeparture);
  }

  onHotelCheckInChange(value: string): void {
    this.hotelCheckIn = value;
    this.ensureHotelCheckOutAfterCheckIn();
    this.clearValidation();
  }

  onHotelCheckOutChange(value: string): void {
    this.hotelCheckOut = value;
    this.ensureHotelCheckOutAfterCheckIn();
    this.clearValidation();
  }

  minHotelCheckOutDate(): string | null {
    return this.nextDateString(this.hotelCheckIn);
  }

  private getValidationError(): string | null {
    if (this.tripType() === 'flight') {
      if (!this.fromCity.trim() || !this.toCity.trim()) {
        return 'Enter both origin and destination before analyzing.';
      }
      if (this.fromCity.trim().toUpperCase() === this.toCity.trim().toUpperCase()) {
        return 'Origin and destination need to be different.';
      }
      if (this.earliestDeparture && this.latestReturn) {
        const depart = this.localDateValue(this.earliestDeparture);
        const returns = this.localDateValue(this.latestReturn);
        if (!depart || !returns) {
          return 'Use valid departure and return dates.';
        }
        if (returns <= depart) {
          return 'Latest return needs to be after earliest departure.';
        }
      }
      if (!Number.isFinite(this.tripLengthMin) || !Number.isFinite(this.tripLengthMax) || this.tripLengthMin < 1 || this.tripLengthMax < 1) {
        return 'Trip length must be at least 1 night.';
      }
      if (this.tripLengthMin > this.tripLengthMax) {
        return 'Trip length minimum cannot be greater than maximum.';
      }
    }

    if (this.tripType() === 'hotel') {
      if (this.hotelCheckIn && this.hotelCheckOut) {
        const checkIn = this.localDateValue(this.hotelCheckIn);
        const checkOut = this.localDateValue(this.hotelCheckOut);
        if (!checkIn || !checkOut) {
          return 'Use valid hotel check-in and check-out dates.';
        }
        if (checkOut <= checkIn) {
          return 'Check-out needs to be after check-in.';
        }
      }
      if (!Number.isFinite(this.hotelNights) || this.hotelNights < 1) {
        return 'Hotel nights must be at least 1.';
      }
    }

    return null;
  }

  private focusInvalidField(error: string): void {
    const target =
      error.includes('both origin') || error.includes('Origin') ? (!this.fromCity.trim() ? this.fromInput : this.toInput) :
      error.includes('departure') ? this.earliestDepartureInput :
      error.includes('return') ? this.latestReturnInput :
      error.includes('Trip length minimum') ? this.tripLengthMaxInput :
      error.includes('Trip length') ? this.tripLengthMinInput :
      error.includes('check-in') ? this.hotelCheckInInput :
      error.includes('Check-out') ? this.hotelCheckOutInput :
      error.includes('Hotel nights') ? this.hotelDestInput :
      undefined;

    const element = target?.nativeElement;
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    element.focus({ preventScroll: true });
  }

  private normalizePlanningInputs(): void {
    this.passengers = this.toBoundedInt(this.passengers, 1, 9, 1);
    this.tripLengthMin = this.toBoundedInt(this.tripLengthMin, 1, 45, 5);
    this.tripLengthMax = this.toBoundedInt(this.tripLengthMax, 1, 60, Math.max(this.tripLengthMin, 10));
    this.hotelNights = this.toBoundedInt(this.hotelNights, 1, 30, 5);
    this.hotelTravelers = this.toBoundedInt(this.hotelTravelers, 1, 9, 2);
    this.hotelRooms = this.toBoundedInt(this.hotelRooms, 1, 5, 1);
    if (this.tripType() === 'flight') this.ensureLatestReturnAfterDeparture();
    if (this.tripType() === 'hotel') this.ensureHotelCheckOutAfterCheckIn();
  }

  private ensureLatestReturnAfterDeparture(): void {
    if (!this.earliestDeparture) return;

    const depart = this.localDateValue(this.earliestDeparture);
    if (!depart) return;

    const returns = this.latestReturn ? this.localDateValue(this.latestReturn) : null;
    if (returns && returns > depart) return;

    this.latestReturn = this.formatDateInputValue(this.addDays(depart, 1));
    this.syncLatestReturnInputValue();
  }

  private syncLatestReturnInputValue(): void {
    const input = this.latestReturnInput?.nativeElement;
    if (!input) return;

    const value = this.latestReturn;
    const applyValue = () => {
      if (input.value !== value) {
        input.value = value;
      }
    };

    applyValue();
    window.setTimeout(applyValue, 0);
  }

  private ensureHotelCheckOutAfterCheckIn(): void {
    if (!this.hotelCheckIn) return;

    const checkIn = this.localDateValue(this.hotelCheckIn);
    if (!checkIn) return;

    const checkOut = this.hotelCheckOut ? this.localDateValue(this.hotelCheckOut) : null;
    if (checkOut && checkOut > checkIn) return;

    this.hotelCheckOut = this.formatDateInputValue(this.addDays(checkIn, 1));
    this.syncHotelCheckOutInputValue();
  }

  private syncHotelCheckOutInputValue(): void {
    const input = this.hotelCheckOutInput?.nativeElement;
    if (!input) return;

    const value = this.hotelCheckOut;
    const applyValue = () => {
      if (input.value !== value) {
        input.value = value;
      }
    };

    applyValue();
    window.setTimeout(applyValue, 0);
  }

  private toBoundedInt(value: unknown, min: number, max: number, fallback: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
  }

  openRelatedSweetSpots(): void {
    const filter = this.tripType() === 'hotel' ? 'hotel' : 'flight';
    try { localStorage.setItem('tally_sweetspots_filter_v1', filter); } catch {}
    this.analytics.track('sweet_spots_deep_linked', { from: 'optimizer', filter });
    this.nav.navigateTo({ tab: 'sweetspots' });
  }

  normalizeAirportInput(value: string): string {
    const trimmed = value.trim();
    const exact = this.airportSearch.findByCode(trimmed) ??
      this.airportSearch.search(trimmed, 1).find(airport =>
        airport.city.toLowerCase() === trimmed.toLowerCase() ||
        airport.name.toLowerCase() === trimmed.toLowerCase()
      );
    if (exact) {
      this.airportSearch.rememberAirport(exact.code);
      return exact.code;
    }
    return trimmed.toUpperCase().slice(0, 32);
  }

  saveCurrentSearch(): void {
    if (this.savedSearchLimitReached()) return;
    this.searches.createSearch(this.buildSavedSearchPayload());
  }

  applySavedSearch(search: OptimizerSavedSearch): void {
    this.searches.markRun(search.id);
    this.tripType.set(search.tripType);
    this.fromCity = search.fromCity ?? '';
    this.toCity = search.toCity ?? '';
    this.cabin = search.cabin ?? 'business';
    this.passengers = search.passengers ?? 1;
    this.tripDirection = search.tripDirection ?? 'roundtrip';
    this.earliestDeparture = search.earliestDeparture ?? '';
    this.latestReturn = search.latestReturn ?? '';
    this.tripLengthMin = search.tripLengthMin ?? 5;
    this.tripLengthMax = search.tripLengthMax ?? 10;
    this.flexibilityPreset = search.flexibilityPreset ?? 'plus7';
    this.hotelDest = search.hotelDest ?? '';
    this.hotelCategory = search.hotelCategory ?? 'mid';
    this.hotelNights = search.hotelNights ?? 5;
    this.hotelCheckIn = search.hotelCheckIn ?? '';
    this.hotelCheckOut = search.hotelCheckOut ?? '';
    this.hotelTravelers = search.hotelTravelers ?? 2;
    this.hotelRooms = search.hotelRooms ?? 1;
    this.showQuickWins.set(false);
    this.analyze();
  }

  deleteSavedSearch(id: string): void {
    this.searches.deleteSearch(id);
  }

  getSearchSyncLabel(): string {
    switch (this.searches.syncState()) {
      case 'loading': return 'Syncing';
      case 'error': return 'Local changes pending';
      case 'synced': return 'Synced';
      default: return 'Saved locally';
    }
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

  /** Combined balance the user holds across the recommendation's eligible programs */
  getBestBalance(rec: Recommendation): number {
    return this.wallet.getCombinedBalance(rec.cards);
  }

  /** Estimated cash value of the redemption */
  getCashValue(rec: Recommendation): number {
    const pts = rec.ptsRequired ?? rec.ptsBase;
    return Math.round(pts * rec.cpp / 100);
  }

  getFlexLabel(): string {
    const labels: Record<FlexPreset, string> = {
      exact: 'exact dates',
      plus3: '±3 days',
      plus7: '±7 days',
      month: 'whole month',
      next60: 'next 60 days',
    };
    return labels[this.flexibilityPreset];
  }

  private getPointsBand(recs: Recommendation[]): string {
    if (!recs.length) return 'Not enough data yet';
    const points = recs.map(r => r.ptsRequired ?? r.ptsBase).filter(Boolean).sort((a, b) => a - b);
    const low = points[0] ?? 0;
    const high = points[Math.min(points.length - 1, 2)] ?? low;
    return low === high ? `${low.toLocaleString()} pts` : `${low.toLocaleString()}-${high.toLocaleString()} pts`;
  }

  private getBestCoverageLabel(recs: Recommendation[]): string {
    if (!this.wallet.hasAnyPoints()) return 'Add balances to compare coverage';
    const best = Math.max(0, ...recs.map(r => this.getCovPct(r)));
    if (best >= 100) return 'You can cover at least one option';
    if (best > 0) return `Best match is ${best}% covered`;
    return 'No matching balance yet';
  }

  private getFlightDateWindowSummary(): string {
    if (this.flexibilityPreset === 'next60') return 'Any good day in the next 60 days';
    const depart = this.earliestDeparture ? this.formatShortDate(this.earliestDeparture) : 'any departure';
    const returns = this.tripDirection === 'oneway'
      ? 'one-way'
      : (this.latestReturn ? `return by ${this.formatShortDate(this.latestReturn)}` : `${this.tripLengthMin}-${this.tripLengthMax} nights`);
    return `${depart} · ${returns} · ${this.getFlexLabel()}`;
  }

  private getHotelDateWindowSummary(): string {
    const checkIn = this.hotelCheckIn ? this.formatShortDate(this.hotelCheckIn) : 'flexible check-in';
    const checkOut = this.hotelCheckOut ? this.formatShortDate(this.hotelCheckOut) : `${this.hotelNights} nights`;
    return `${checkIn} to ${checkOut} · ${this.hotelTravelers} traveler${this.hotelTravelers === 1 ? '' : 's'} · ${this.hotelRooms} room${this.hotelRooms === 1 ? '' : 's'}`;
  }

  private getHotelStrategyRoute(): string {
    const destination = this.hotelDest.trim() || 'Flexible destination';
    return `${destination} · ${this.hotelCategory} hotels`;
  }

  private getStrategyExpiryNote(recs: Recommendation[]): string {
    const warning = recs.map(r => this.getExpiryWarning(r)).find(Boolean);
    if (!warning) return 'No urgent expiry conflict found for these recommendations.';
    if (warning.urgency === 'expired') return `${warning.programName} points may already be expired; confirm balance before transferring.`;
    return `${warning.programName} expires in ${warning.daysRemaining} day${warning.daysRemaining === 1 ? '' : 's'}; prioritize this currency if the routing fits.`;
  }

  private formatShortDate(value: string): string {
    try {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return value;
    }
  }

  private syncHotelNightsFromDates(): void {
    if (!this.hotelCheckIn || !this.hotelCheckOut) return;
    const start = this.localDateValue(this.hotelCheckIn);
    const end = this.localDateValue(this.hotelCheckOut);
    if (!start || !end || end <= start) return;
    const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
    this.hotelNights = Math.min(30, Math.max(1, nights));
  }

  private localDateValue(value: string): Date | null {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private nextDateString(value: string): string | null {
    const date = value ? this.localDateValue(value) : null;
    return date ? this.formatDateInputValue(this.addDays(date, 1)) : null;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private formatDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Percentage of required points the user already has (0–100, capped at 100) */
  getCovPct(rec: Recommendation): number {
    const required = rec.ptsRequired ?? rec.ptsBase;
    if (!required) return 0;
    return Math.min(100, Math.round((this.getBestBalance(rec) / required) * 100));
  }

  /**
   * Returns the shortfall (points gap) when the user has some coverage but not full.
   * Returns null when: no wallet data, already fully covered, or zero coverage.
   */
  getPointsGap(rec: Recommendation): number | null {
    if (!this.wallet.hasAnyPoints()) return null;
    const required = rec.ptsRequired ?? rec.ptsBase;
    const best = this.getBestBalance(rec);
    if (best <= 0 || best >= required) return null;
    return required - best;
  }

  /**
   * Returns the most urgent ExpiryStatus for any card that feeds this recommendation,
   * so the optimizer can warn the user their points are at risk.
   * Only surfaces 'critical', 'expired', or 'warning' states.
   */
  getExpiryWarning(rec: Recommendation): ExpiryStatus | null {
    const statuses = this.expiry.statuses();
    const urgencyRank: Record<string, number> = { expired: 3, critical: 2, warning: 1 };
    let best: ExpiryStatus | null = null;
    for (const s of statuses) {
      if (!rec.cards.includes(s.cardId)) continue;
      const rank = urgencyRank[s.urgency] ?? 0;
      if (rank === 0) continue;
      if (!best || rank > (urgencyRank[best.urgency] ?? 0)) best = s;
    }
    return best;
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

  reanalyzeTrip(trip: SavedTrip): void {
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
    document.querySelector('.app-main')?.scrollTo({ top: 0, behavior: 'smooth' });
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
      if (!raw) return [];
      const entries = this.sanitizeRouteHistory(JSON.parse(raw) as unknown);
      this.saveRouteHistory(entries);
      return entries;
    } catch {
      return [];
    }
  }

  private saveRouteHistory(entries: RouteHistoryEntry[]): void {
    try { localStorage.setItem(ROUTE_HISTORY_KEY, JSON.stringify(this.sanitizeRouteHistory(entries))); } catch {}
  }

  private sanitizeRouteHistory(value: unknown): RouteHistoryEntry[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const entries: RouteHistoryEntry[] = [];

    for (const raw of value) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Partial<RouteHistoryEntry>;
      const tripType = item.tripType === 'hotel' ? 'hotel' : item.tripType === 'flight' ? 'flight' : null;
      const cabin = CABIN_CLASSES.has(item.cabin as CabinClass) ? item.cabin as CabinClass : null;
      const hotelCategory = HOTEL_CATEGORIES.has(item.hotelCategory as HotelCategory)
        ? item.hotelCategory as HotelCategory
        : null;
      if (!tripType || !cabin || !hotelCategory) continue;

      const passengers = this.clampWholeNumber(item.passengers, 1, 9);
      const hotelNights = this.clampWholeNumber(item.hotelNights, 1, 30);
      const label = this.cleanHistoryText(item.label, 96);
      if (!label || seen.has(label)) continue;
      seen.add(label);

      entries.push({
        tripType,
        fromCity: this.cleanHistoryText(item.fromCity, 40),
        toCity: this.cleanHistoryText(item.toCity, 40),
        cabin,
        passengers,
        hotelCategory,
        hotelNights,
        label,
        ts: this.validIsoDate(item.ts),
      });

      if (entries.length >= MAX_ROUTE_HISTORY) break;
    }

    return entries;
  }

  private cleanHistoryText(value: unknown, maxLength: number): string {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
  }

  private clampWholeNumber(value: unknown, min: number, max: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }

  private validIsoDate(value: unknown): string {
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    }
    return new Date().toISOString();
  }

  private buildSavedSearchPayload(): Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'> {
    const destinationText = this.tripType() === 'flight'
      ? this.normalizeAirportInput(this.toCity || 'ANY')
      : (this.hotelDest.trim() || 'Hotel search');
    const dateWindow = {
      startDate: this.tripType() === 'flight' ? this.earliestDeparture : this.hotelCheckIn,
      endDate: this.tripType() === 'flight' ? this.latestReturn : this.hotelCheckOut,
      flexibility: this.toDateFlexibility(this.flexibilityPreset),
      tripLengthMin: this.tripLengthMin,
      tripLengthMax: this.tripLengthMax,
    };

    if (this.tripType() === 'hotel') {
      return {
        searchType: 'hotel',
        destinationText,
        dateWindow,
        passengers: this.hotelTravelers,
        hotelIntent: {
          destination: destinationText,
          checkInDate: this.hotelCheckIn || undefined,
          checkOutDate: this.hotelCheckOut || undefined,
          nights: this.hotelNights,
          hotelCategory: this.hotelCategory,
          travelers: this.hotelTravelers,
          rooms: this.hotelRooms,
          preferredChains: [],
        },
      };
    }

    const originAirport = this.fromCity.trim() ? this.normalizeAirportInput(this.fromCity) : undefined;
    const destinationAirport = this.toCity.trim() ? this.normalizeAirportInput(this.toCity) : undefined;
    return {
      searchType: 'flight',
      originAirport,
      destinationAirport,
      destinationText,
      dateWindow,
      cabin: this.cabin,
      passengers: this.passengers,
    };
  }

  private toOptimizerSavedSearch(search: SavedSearch): OptimizerSavedSearch {
    return {
      id: search.id,
      tripType: search.searchType,
      label: this.getSavedSearchLabel(search),
      createdAt: search.createdAt,
      fromCity: search.originAirport ?? '',
      toCity: search.destinationAirport ?? '',
      cabin: search.cabin ?? 'business',
      passengers: search.passengers,
      tripDirection: search.dateWindow.endDate ? 'roundtrip' : 'oneway',
      earliestDeparture: search.dateWindow.startDate,
      latestReturn: search.dateWindow.endDate,
      tripLengthMin: search.dateWindow.tripLengthMin ?? 5,
      tripLengthMax: search.dateWindow.tripLengthMax ?? 10,
      flexibilityPreset: this.fromDateFlexibility(search.dateWindow.flexibility),
      hotelDest: search.hotelIntent?.destination ?? search.destinationText,
      hotelCategory: search.hotelIntent?.hotelCategory ?? 'mid',
      hotelNights: search.hotelIntent?.nights ?? 5,
      hotelCheckIn: search.hotelIntent?.checkInDate ?? search.dateWindow.startDate,
      hotelCheckOut: search.hotelIntent?.checkOutDate ?? search.dateWindow.endDate,
      hotelTravelers: search.hotelIntent?.travelers ?? search.passengers,
      hotelRooms: search.hotelIntent?.rooms ?? 1,
    };
  }

  private getSavedSearchLabel(search: SavedSearch): string {
    if (search.searchType === 'flight') {
      const from = search.originAirport || 'Anywhere';
      const to = search.destinationAirport || search.destinationText || 'Anywhere';
      return `${from}→${to} · ${this.getFlexLabelFor(search.dateWindow.flexibility)} · ${search.cabin ?? 'any cabin'}`;
    }
    const nights = search.hotelIntent?.nights ?? search.dateWindow.tripLengthMin ?? 1;
    const category = search.hotelIntent?.hotelCategory ?? 'mid';
    return `${search.destinationText || 'Hotel search'} · ${nights}n · ${category}`;
  }

  private toDateFlexibility(value: FlexPreset): DateFlexibility {
    const map: Record<FlexPreset, DateFlexibility> = {
      exact: 'exact',
      plus3: 'plus_minus_3',
      plus7: 'plus_minus_7',
      month: 'month',
      next60: 'next_60_days',
    };
    return map[value];
  }

  private fromDateFlexibility(value: DateFlexibility): FlexPreset {
    const map: Record<DateFlexibility, FlexPreset> = {
      exact: 'exact',
      plus_minus_3: 'plus3',
      plus_minus_7: 'plus7',
      month: 'month',
      next_60_days: 'next60',
    };
    return map[value] ?? 'plus7';
  }

  private getFlexLabelFor(value: DateFlexibility): string {
    const labels: Record<DateFlexibility, string> = {
      exact: 'exact dates',
      plus_minus_3: '±3 days',
      plus_minus_7: '±7 days',
      month: 'whole month',
      next_60_days: 'next 60 days',
    };
    return labels[value];
  }

  private buildSavedSearchLabel(): string {
    if (this.tripType() === 'flight') {
      const from = this.fromCity || 'Anywhere';
      const to = this.toCity || 'Anywhere';
      return `${from}→${to} · ${this.getFlexLabel()} · ${this.cabin}`;
    }
    const dest = this.hotelDest.trim() || 'Hotel search';
    return `${dest} · ${this.hotelNights}n · ${this.hotelCategory}`;
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

  /**
   * Suggest popular destination airports based on the home airport's region.
   * Hawaii residents get mainland suggestions; mainland US gets international + Hawaii.
   */
  readonly quickDestinations = computed((): { to: string; flag: string; label: string }[] => {
    const home = this.homeAirport();
    if (!home) return [];
    const HAWAII = new Set(['HNL','OGG','KOA','LIH','ITO','MKK','LNY']);
    if (HAWAII.has(home)) {
      return [
        { to: 'LAX', flag: '🌴', label: 'West Coast' },
        { to: 'ORD', flag: '🏙', label: 'Midwest' },
        { to: 'JFK', flag: '🗽', label: 'East Coast' },
        { to: 'LHR', flag: '🇬🇧', label: 'Europe' },
      ];
    }
    return [
      { to: 'LHR', flag: '🇬🇧', label: 'Europe' },
      { to: 'NRT', flag: '🎌', label: 'Japan' },
      { to: 'HNL', flag: '🌺', label: 'Hawaii' },
      { to: 'CUN', flag: '🌴', label: 'Caribbean' },
      { to: 'CDG', flag: '🇫🇷', label: 'Paris' },
      { to: 'DXB', flag: '🇦🇪', label: 'Dubai' },
    ];
  });

  applyQuickDest(d: { to: string; flag: string; label: string }): void {
    this.toCity = d.to;
    this.showQuickWins.set(false);
    this.analyze();
  }

  applyWalletSuggestion(hint: { tripType: 'flight' | 'hotel'; programCat: string }): void {
    this.tripType.set(hint.tripType);
    if (hint.tripType === 'hotel') {
      this.hotelCategory = 'mid';
    } else {
      // Pre-fill home airport if the From field is empty
      if (!this.fromCity && this.homeAirport()) {
        this.fromCity = this.homeAirport();
      }
    }
    this.showQuickWins.set(false);
    this.analyze();
  }

  // ── Home airport ────────────────────────────────────────────────────────────
  private _loadHomeAirport(): string {
    try {
      const code = this.cleanAirportCode(localStorage.getItem(HOME_AIRPORT_KEY));
      if (code) localStorage.setItem(HOME_AIRPORT_KEY, code);
      else localStorage.removeItem(HOME_AIRPORT_KEY);
      return code;
    } catch { return ''; }
  }

  setHomeAirport(): void {
    const code = this.cleanAirportCode(this.fromCity);
    if (!code) return;
    try { localStorage.setItem(HOME_AIRPORT_KEY, code); } catch {}
    this._homeAirport.set(code);
  }

  useHomeAirport(): void {
    this.fromCity = this._homeAirport();
  }

  private cleanAirportCode(value: unknown): string {
    if (typeof value !== 'string') return '';
    const code = value.trim().toUpperCase();
    return this.airportSearch.findByCode(code) ? code : '';
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

  getHowToSteps(program: string): string[] { return HOW_TO_BOOK[program]?.steps ?? []; }
  getBookingUrl(program: string): string | null { return HOW_TO_BOOK[program]?.url ?? null; }

  howToPanelId(program: string): string {
    return `optimizer-howto-${this.safeDomId(program)}`;
  }

  toggleHowTo(program: string): void {
    this.expandedHowTo.update(cur => cur === program ? null : program);
  }

  private safeDomId(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  }

}

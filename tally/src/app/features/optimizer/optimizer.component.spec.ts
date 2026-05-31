import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AirportSearchService } from '../../core/services/airport-search.service';
import { DataService } from '../../core/services/data.service';
import { ExpiryService } from '../../core/services/expiry.service';
import { NavigationService } from '../../core/services/navigation.service';
import { OptimizerService } from '../../core/services/optimizer.service';
import { SearchesService } from '../../core/services/searches.service';
import { TripsService } from '../../core/services/trips.service';
import { WalletService } from '../../core/services/wallet.service';
import { SavedSearch } from '../../core/models';
import { OptimizerComponent } from './optimizer.component';

class MockOptimizerService {
  getAllRecs(): [] { return []; }
  getFlightRecs(): { recs: []; category: string } { return { recs: [], category: 'default' }; }
  getHotelRecs(): [] { return []; }
}

class MockWalletService {
  hasAnyPoints = signal(false);
  canCover(): boolean { return false; }
  getCombinedBalance(): number { return 0; }
  getBalance(): number { return 0; }
}

class MockDataService {
  cards = [];
}

class MockTripsService {
  trips = signal([]);
  localOnlyCount = signal(0);
  saveTrip = jasmine.createSpy('saveTrip');
  deleteTrip = jasmine.createSpy('deleteTrip');
  updateNotes = jasmine.createSpy('updateNotes');
  clearAll = jasmine.createSpy('clearAll');
}

class MockExpiryService {
  statuses = signal([]);
}

class MockAnalyticsService {
  track = jasmine.createSpy('track');
}

class MockNavigationService {
  navigateTo = jasmine.createSpy('navigateTo');
}

class MockSearchesService {
  searches = signal<SavedSearch[]>([]);
  syncState = signal('idle');
  createSearch = jasmine.createSpy('createSearch');
  deleteSearch = jasmine.createSpy('deleteSearch');
  markRun = jasmine.createSpy('markRun');
}

class MockAirportSearchService {
  airports(): [] { return []; }
  findByCode(): null { return null; }
  search(): [] { return []; }
  rememberAirport = jasmine.createSpy('rememberAirport');
}

describe('OptimizerComponent', () => {
  let fixture: ComponentFixture<OptimizerComponent>;
  let component: OptimizerComponent;
  let searches: MockSearchesService;
  let wallet: MockWalletService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptimizerComponent],
      providers: [
        { provide: OptimizerService, useClass: MockOptimizerService },
        { provide: WalletService, useClass: MockWalletService },
        { provide: DataService, useClass: MockDataService },
        { provide: TripsService, useClass: MockTripsService },
        { provide: ExpiryService, useClass: MockExpiryService },
        { provide: AnalyticsService, useClass: MockAnalyticsService },
        { provide: NavigationService, useClass: MockNavigationService },
        { provide: SearchesService, useClass: MockSearchesService },
        { provide: AirportSearchService, useClass: MockAirportSearchService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OptimizerComponent);
    component = fixture.componentInstance;
    searches = TestBed.inject(SearchesService) as unknown as MockSearchesService;
    wallet = TestBed.inject(WalletService) as unknown as MockWalletService;
    fixture.detectChanges();
  });

  it('moves latest return to the day after earliest departure when needed', () => {
    component.latestReturn = '2026-06-10';

    component.onEarliestDepartureChange('2026-06-10');

    expect(component.earliestDeparture).toBe('2026-06-10');
    expect(component.latestReturn).toBe('2026-06-11');
    expect(component.minLatestReturnDate()).toBe('2026-06-11');
  });

  it('exposes trip type toggle state to assistive tech', () => {
    const group = fixture.nativeElement.querySelector('.type-toggle') as HTMLElement;
    const [flightButton, hotelButton] = Array.from(
      fixture.nativeElement.querySelectorAll('.type-toggle .toggle-btn'),
    ) as HTMLButtonElement[];

    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Trip search type');
    expect(flightButton.getAttribute('role')).toBe('radio');
    expect(hotelButton.getAttribute('role')).toBe('radio');
    expect(flightButton.getAttribute('aria-checked')).toBe('true');
    expect(hotelButton.getAttribute('aria-checked')).toBe('false');
    expect(flightButton.hasAttribute('aria-pressed')).toBeFalse();

    hotelButton.click();
    fixture.detectChanges();

    expect(flightButton.getAttribute('aria-checked')).toBe('false');
    expect(hotelButton.getAttribute('aria-checked')).toBe('true');
  });

  it('ignores hidden Can afford filter when wallet has no points', () => {
    component.results.set([
      { program: 'United', partner: 'Chase UR', cpp: 1.8, ptsBase: 50000, cards: ['chase_ur'], note: 'Test route' },
    ]);
    component.canAffordOnly.set(true);

    expect(component.filteredResults().length).toBe(1);
  });

  it('keeps an existing return date when it is after earliest departure', () => {
    component.latestReturn = '2026-06-20';

    component.onEarliestDepartureChange('2026-06-10');

    expect(component.latestReturn).toBe('2026-06-20');
  });

  it('clamps manually entered latest return dates that are not after departure', () => {
    component.earliestDeparture = '2026-06-10';

    component.onLatestReturnChange('2026-06-09');

    expect(component.latestReturn).toBe('2026-06-11');
  });

  it('syncs the visible latest return input after clamping an invalid date', fakeAsync(() => {
    const latestInput = fixture.nativeElement.querySelector('#optimizer-latest') as HTMLInputElement;
    component.earliestDeparture = '2026-06-10';
    latestInput.value = '2026-06-09';

    component.onLatestReturnChange(latestInput.value);
    tick();

    expect(component.latestReturn).toBe('2026-06-11');
    expect(latestInput.value).toBe('2026-06-11');
  }));

  it('does not create more saved searches after the visible limit', () => {
    searches.searches.set(Array.from({ length: 5 }, (_, i) => ({
      id: `search_${i}`,
      searchType: 'flight',
      destinationText: 'Tokyo',
      dateWindow: { startDate: '2026-06-10', endDate: '2026-06-20', flexibility: 'plus_minus_3' },
      passengers: 1,
      createdAt: '2026-05-31T00:00:00.000Z',
      updatedAt: '2026-05-31T00:00:00.000Z',
    })));
    fixture.detectChanges();

    component.saveCurrentSearch();

    expect(searches.createSearch).not.toHaveBeenCalled();
    const saveButton = fixture.nativeElement.querySelector('.btn-save-search') as HTMLButtonElement;
    expect(saveButton.disabled).toBeTrue();
  });

  it('deletes saved searches from the management row', () => {
    searches.searches.set([{
      id: 'search_1',
      searchType: 'flight',
      originAirport: 'ORD',
      destinationAirport: 'NRT',
      destinationText: 'Tokyo',
      dateWindow: { startDate: '2026-06-10', endDate: '2026-06-20', flexibility: 'plus_minus_3' },
      cabin: 'business',
      passengers: 1,
      createdAt: '2026-05-31T00:00:00.000Z',
      updatedAt: '2026-05-31T00:00:00.000Z',
    }]);
    fixture.detectChanges();

    const deleteButton = fixture.nativeElement.querySelector('.ss-del') as HTMLButtonElement;
    deleteButton.click();

    expect(searches.deleteSearch).toHaveBeenCalledWith('search_1');
  });

  it('marks saved searches as run when reapplied', () => {
    searches.searches.set([{
      id: 'search_1',
      searchType: 'flight',
      originAirport: 'ORD',
      destinationAirport: 'NRT',
      destinationText: 'Tokyo',
      dateWindow: { startDate: '2026-06-10', endDate: '2026-06-20', flexibility: 'plus_minus_3' },
      cabin: 'business',
      passengers: 1,
      createdAt: '2026-05-31T00:00:00.000Z',
      updatedAt: '2026-05-31T00:00:00.000Z',
    }]);
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.ss-chip') as HTMLButtonElement;
    chip.click();

    expect(searches.markRun).toHaveBeenCalledWith('search_1');
  });

  it('wires expandable Optimizer panels to controlled regions', () => {
    wallet.hasAnyPoints.set(true);
    component.showQuickWins.set(true);
    component.results.set([
      {
        program: 'Air Canada Aeroplan',
        partner: 'Air Canada',
        cpp: 2.1,
        ptsBase: 60000,
        cards: ['amex_mr'],
        note: 'Test route',
      },
    ]);
    component.toggleHowTo('Air Canada Aeroplan');

    fixture.detectChanges();

    const quickWinsToggle = fixture.nativeElement.querySelector('.btn-quick-wins') as HTMLButtonElement;
    expect(quickWinsToggle.getAttribute('aria-controls')).toBe('optimizer-quick-wins');
    expect(fixture.nativeElement.querySelector('#optimizer-quick-wins')).not.toBeNull();

    const howToId = component.howToPanelId('Air Canada Aeroplan');
    const howToButton = fixture.nativeElement.querySelector('.howto-btn') as HTMLButtonElement;
    expect(howToButton.getAttribute('aria-controls')).toBe(howToId);
    expect(howToButton.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector(`#${howToId}`)).not.toBeNull();
  });
});

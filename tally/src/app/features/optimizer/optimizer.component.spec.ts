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
import { OptimizerComponent } from './optimizer.component';

class MockOptimizerService {
  getAllRecs(): [] { return []; }
  getFlightRecs(): { recs: []; category: string } { return { recs: [], category: 'default' }; }
  getHotelRecs(): [] { return []; }
}

class MockWalletService {
  hasAnyPoints = signal(false);
  canCover(): boolean { return false; }
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
  searches = signal([]);
  createSearch = jasmine.createSpy('createSearch');
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
    fixture.detectChanges();
  });

  it('moves latest return to the day after earliest departure when needed', () => {
    component.latestReturn = '2026-06-10';

    component.onEarliestDepartureChange('2026-06-10');

    expect(component.earliestDeparture).toBe('2026-06-10');
    expect(component.latestReturn).toBe('2026-06-11');
    expect(component.minLatestReturnDate()).toBe('2026-06-11');
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
});

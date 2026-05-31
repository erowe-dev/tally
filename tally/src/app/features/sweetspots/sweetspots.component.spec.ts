import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnalyticsService } from '../../core/services/analytics.service';
import { DataService } from '../../core/services/data.service';
import { NavigationService } from '../../core/services/navigation.service';
import { ToastService } from '../../core/services/toast.service';
import { WalletService } from '../../core/services/wallet.service';
import { SweetspotsComponent } from './sweetspots.component';

class MockWalletService {
  hasAnyPoints = signal(false);
  getBalance(_cardId: string): number {
    return 0;
  }
}

class MockNavigationService {
  navigateTo = jasmine.createSpy('navigateTo');
}

describe('SweetspotsComponent', () => {
  const UI_KEY = 'tally_sweetspots_ui_v1';
  const FILTER_KEY = 'tally_sweetspots_filter_v1';
  const SEARCH_KEY = 'tally_sweetspots_search_session_v1';
  let fixture: ComponentFixture<SweetspotsComponent>;

  const sweetSpots = [
    {
      route: 'US -> Europe',
      detail: 'Business class',
      ptsNeeded: '50,000',
      estCash: '$2,000',
      cpp: '4.0',
      cards: ['Amex MR'],
      programs: ['Air France/KLM Flying Blue'],
      note: 'A strong transatlantic option.',
      category: 'flight',
      isNew: true,
    },
    {
      route: 'Park Hyatt',
      detail: 'Luxury hotel',
      ptsNeeded: '30,000',
      estCash: '$900',
      cpp: '3.0',
      cards: ['Chase UR'],
      programs: ['World of Hyatt'],
      note: 'A strong hotel option.',
      category: 'hotel',
    },
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [SweetspotsComponent],
      providers: [
        { provide: WalletService, useValue: new MockWalletService() },
        { provide: NavigationService, useValue: new MockNavigationService() },
        { provide: AnalyticsService, useValue: { track: jasmine.createSpy('track') } },
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
        { provide: DataService, useValue: { sweetSpots, transferBonuses: [], cards: [] } },
      ],
    }).compileComponents();
  });

  function createComponent(): SweetspotsComponent {
    fixture = TestBed.createComponent(SweetspotsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('restores durable filters and session search', () => {
    localStorage.setItem(UI_KEY, JSON.stringify({
      activeFilter: 'hotel',
      activeSort: 'cpp',
      minCppFilter: 2,
    }));
    sessionStorage.setItem(SEARCH_KEY, 'hyatt');

    const component = createComponent();

    expect(component.activeFilter()).toBe('hotel');
    expect(component.activeSort()).toBe('cpp');
    expect(component.minCppFilter()).toBe(2);
    expect(component.searchRaw()).toBe('hyatt');
  });

  it('lets optimizer deep-link filter override stored state once', () => {
    localStorage.setItem(UI_KEY, JSON.stringify({ activeFilter: 'hotel' }));
    localStorage.setItem(FILTER_KEY, 'flight');

    const component = createComponent();

    expect(component.activeFilter()).toBe('flight');
    expect(localStorage.getItem(FILTER_KEY)).toBeNull();
  });

  it('clears non-search filters from an empty state recovery action', () => {
    const component = createComponent();
    component.activeFilter.set('new');
    component.activeSort.set('pts');
    component.minCppFilter.set(2.5);

    expect(component.hasActiveFilters()).toBeTrue();

    component.clearFilters();

    expect(component.activeFilter()).toBe('all');
    expect(component.activeSort()).toBe('default');
    expect(component.minCppFilter()).toBe(0);
  });

  it('exposes mutually exclusive filter controls as radio groups', () => {
    const component = createComponent();

    const categoryGroup = fixture.nativeElement.querySelector('.filter-row[role="radiogroup"]') as HTMLElement;
    const sortGroup = fixture.nativeElement.querySelector('.sort-row[role="radiogroup"]') as HTMLElement;
    const cppGroup = fixture.nativeElement.querySelector('.cpp-tiers[role="radiogroup"]') as HTMLElement;

    expect(categoryGroup.getAttribute('aria-label')).toBe('Sweet spot category filter');
    expect(sortGroup.getAttribute('aria-label')).toBe('Sweet spot sort order');
    expect(cppGroup.getAttribute('aria-label')).toBe('Minimum cents per point filter');

    const categoryRadios = Array.from(categoryGroup.querySelectorAll('[role="radio"]')) as HTMLElement[];
    const sortRadios = Array.from(sortGroup.querySelectorAll('[role="radio"]')) as HTMLElement[];
    const cppRadios = Array.from(cppGroup.querySelectorAll('[role="radio"]')) as HTMLElement[];

    expect(categoryRadios.find(button => button.textContent?.includes('All'))?.getAttribute('aria-checked')).toBe('true');
    expect(sortRadios.find(button => button.textContent?.includes('Default'))?.getAttribute('aria-checked')).toBe('true');
    expect(cppRadios.find(button => button.textContent?.includes('Any'))?.getAttribute('aria-checked')).toBe('true');
    expect(categoryGroup.querySelector('[aria-pressed]')).toBeNull();

    component.activeFilter.set('hotel');
    component.activeSort.set('cpp');
    component.minCppFilter.set(2);
    fixture.detectChanges();

    expect(categoryRadios.find(button => button.textContent?.includes('Hotels'))?.getAttribute('aria-checked')).toBe('true');
    expect(sortRadios.find(button => button.textContent?.includes('CPP'))?.getAttribute('aria-checked')).toBe('true');
    expect(cppRadios.find(button => button.textContent?.includes('>2¢'))?.getAttribute('aria-checked')).toBe('true');
  });
});

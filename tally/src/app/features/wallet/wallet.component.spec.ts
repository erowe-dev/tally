import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataService } from '../../core/services/data.service';
import { ExpiryService } from '../../core/services/expiry.service';
import { NavigationService } from '../../core/services/navigation.service';
import { OptimizerService } from '../../core/services/optimizer.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { WalletService } from '../../core/services/wallet.service';
import { WalletComponent } from './wallet.component';

class MockWalletService {
  syncState = signal<'idle' | 'loading' | 'synced' | 'error'>('synced');
  pendingCount = signal(0);
  totalPoints = signal(75000);
  hasAnyPoints = signal(true);
  history = signal([]);
  estimatedValue = signal(1200);
  getBalance = jasmine.createSpy('getBalance').and.returnValue(0);
  setBalance = jasmine.createSpy('setBalance');
  retryLoad = jasmine.createSpy('retryLoad');
}

class MockPreferencesService {
  syncState = signal<'idle' | 'loading' | 'synced' | 'error'>('synced');
  preferences = signal({
    homeAirports: [],
    preferredCabin: 'business',
    maxStops: 1,
    preferredPrograms: [],
    heldProgramIds: [],
    hotelChains: [],
    defaultTravelers: 2,
    dateFlexibility: 'plus_minus_7',
    pointValuationCpp: 1.6,
  });
  updatePreferences = jasmine.createSpy('updatePreferences');
}

describe('WalletComponent', () => {
  const GOAL_KEY = 'tally_wallet_goal_v1';
  let fixture: ComponentFixture<WalletComponent>;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [WalletComponent],
      providers: [
        { provide: WalletService, useClass: MockWalletService },
        { provide: DataService, useValue: { cards: [], transferBonuses: [] } },
        { provide: OptimizerService, useValue: { getAllRecs: () => [] } },
        {
          provide: ExpiryService,
          useValue: {
            statuses: signal([]),
            records: signal({}),
          },
        },
        { provide: PreferencesService, useClass: MockPreferencesService },
        { provide: NavigationService, useValue: { navigateTo: jasmine.createSpy('navigateTo') } },
        { provide: ToastService, useValue: { error: jasmine.createSpy('error') } },
      ],
    }).compileComponents();
  });

  function createComponent(): WalletComponent {
    fixture = TestBed.createComponent(WalletComponent);
    return fixture.componentInstance;
  }

  it('restores a persisted point goal and opens the goal panel', () => {
    localStorage.setItem(GOAL_KEY, JSON.stringify({
      name: 'Tokyo business class',
      points: 120000.6,
      expanded: true,
    }));

    const component = createComponent();

    expect(component.goalName).toBe('Tokyo business class');
    expect(component.goalPts).toBe(120001);
    expect(component.showGoal()).toBeTrue();
    expect(component.goalPct()).toBe(62);
  });

  it('sanitizes invalid persisted goal state', () => {
    localStorage.setItem(GOAL_KEY, JSON.stringify({
      name: 'x'.repeat(140),
      points: -100,
      expanded: false,
    }));

    const component = createComponent();

    expect(component.goalName.length).toBe(120);
    expect(component.goalPts).toBe(0);
    expect(component.showGoal()).toBeTrue();
  });

  it('persists edits to the point goal', () => {
    const component = createComponent();

    component.toggleGoal();
    TestBed.flushEffects();
    component.updateGoalName('Paris hotels');
    component.updateGoalPoints('45000.4');

    expect(JSON.parse(localStorage.getItem(GOAL_KEY) ?? '{}')).toEqual({
      name: 'Paris hotels',
      points: 45000,
      expanded: true,
    });
  });

  it('falls back to a zero point goal for non-numeric input', () => {
    const component = createComponent();

    component.updateGoalPoints('not a number');

    expect(component.goalPts).toBe(0);
    expect(JSON.parse(localStorage.getItem(GOAL_KEY) ?? '{}').points).toBe(0);
  });

  it('toggles held programs without changing balances', () => {
    const prefs = TestBed.inject(PreferencesService) as unknown as MockPreferencesService;
    const wallet = TestBed.inject(WalletService) as unknown as MockWalletService;
    const component = createComponent();

    component.toggleHeldProgram('hyatt');

    expect(prefs.updatePreferences).toHaveBeenCalledWith({ heldProgramIds: ['hyatt'] });
    expect(wallet.setBalance).not.toHaveBeenCalled();
  });

  it('does not remove held state implied by a saved balance', () => {
    const prefs = TestBed.inject(PreferencesService) as unknown as MockPreferencesService;
    const wallet = TestBed.inject(WalletService) as unknown as MockWalletService;
    wallet.getBalance.and.callFake(cardId => cardId === 'hyatt' ? 10000 : 0);
    const component = createComponent();

    component.toggleHeldProgram('hyatt');

    expect(prefs.updatePreferences).not.toHaveBeenCalled();
    expect(component.heldToggleText('hyatt')).toBe('Balance saved');
    expect(component.heldToggleLabel('hyatt', 'World of Hyatt')).toContain('counted as yours');
  });

  it('marks a program held when a positive balance is entered', () => {
    const prefs = TestBed.inject(PreferencesService) as unknown as MockPreferencesService;
    const wallet = TestBed.inject(WalletService) as unknown as MockWalletService;
    const component = createComponent();
    const input = document.createElement('input');
    input.value = '25000';

    component.onInput('amex_mr', { target: input } as unknown as Event);

    expect(wallet.setBalance).toHaveBeenCalledWith('amex_mr', 25000);
    expect(prefs.updatePreferences).toHaveBeenCalledWith({ heldProgramIds: ['amex_mr'] });
  });
});

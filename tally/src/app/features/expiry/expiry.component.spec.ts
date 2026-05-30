import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ExpiryService, ExpiryStatus } from '../../core/services/expiry.service';
import { WalletService } from '../../core/services/wallet.service';
import { ExpiryComponent } from './expiry.component';

class MockExpiryService {
  statuses = signal<ExpiryStatus[]>([]);
  records = signal<Record<string, { cardId: string; lastActivityDate: string }>>({});
  syncState = signal<'idle' | 'loading' | 'synced' | 'error'>('synced');
  pendingCount = signal(0);
  criticalCount = signal(0);
  warningCount = signal(0);
  hasWarnings = signal(false);
  setLastActivity = jasmine.createSpy('setLastActivity');
  clearActivity = jasmine.createSpy('clearActivity');
  retryLoad = jasmine.createSpy('retryLoad');
}

class MockWalletService {
  hasAnyPoints = signal(true);
  balances = new Map<string, number>();

  getBalance(cardId: string): number {
    return this.balances.get(cardId) ?? 0;
  }
}

describe('ExpiryComponent', () => {
  const UI_KEY = 'tally_expiry_ui_session_v1';
  let fixture: ComponentFixture<ExpiryComponent>;
  let expiry: MockExpiryService;
  let wallet: MockWalletService;

  const statuses: ExpiryStatus[] = [
    {
      cardId: 'amex_mr',
      programName: 'Amex Membership Rewards',
      daysRemaining: null,
      urgency: 'never',
      expiryDate: null,
      note: 'Never expires while account is open.',
      actionNeeded: 'No action needed.',
      quickActions: [],
    },
    {
      cardId: 'united_mp',
      programName: 'United MileagePlus',
      daysRemaining: 120,
      urgency: 'safe',
      expiryDate: new Date(2026, 8, 26),
      note: 'Activity extends expiry.',
      actionNeeded: 'Keep earning or redeeming periodically.',
      quickActions: ['Shop through portal'],
    },
  ];

  beforeEach(async () => {
    sessionStorage.clear();
    expiry = new MockExpiryService();
    wallet = new MockWalletService();
    expiry.statuses.set(statuses);
    wallet.balances.set('united_mp', 10000);

    await TestBed.configureTestingModule({
      imports: [ExpiryComponent],
      providers: [
        { provide: ExpiryService, useValue: expiry },
        { provide: WalletService, useValue: wallet },
      ],
    }).compileComponents();
  });

  function createComponent(): ExpiryComponent {
    fixture = TestBed.createComponent(ExpiryComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('restores the Mine filter from session storage', () => {
    sessionStorage.setItem(UI_KEY, 'mine');

    const component = createComponent();

    expect(component.showHeldOnly()).toBeTrue();
    expect(component.visibleStatuses().map(s => s.cardId)).toEqual(['united_mp']);
  });

  it('persists and clears the Mine filter within the session', () => {
    const component = createComponent();

    component.setHeldOnly(true);
    TestBed.flushEffects();

    expect(sessionStorage.getItem(UI_KEY)).toBe('mine');

    component.setHeldOnly(false);
    TestBed.flushEffects();

    expect(sessionStorage.getItem(UI_KEY)).toBeNull();
  });

  it('requires a second tap before marking all expirable programs today', fakeAsync(() => {
    const component = createComponent();

    component.markAllToday();

    expect(component.bulkConfirm()).toBeTrue();
    expect(expiry.setLastActivity).not.toHaveBeenCalled();

    component.markAllToday();

    expect(expiry.setLastActivity).toHaveBeenCalledOnceWith('united_mp', component.todayStr);
    expect(component.bulkDone()).toBeTrue();

    tick(3000);
    expect(component.bulkDone()).toBeFalse();
  }));

  it('marks only visible expirable programs when Mine is enabled', fakeAsync(() => {
    expiry.statuses.set([
      ...statuses,
      {
        cardId: 'aa_aadvantage',
        programName: 'American AAdvantage',
        daysRemaining: 80,
        urgency: 'warning',
        expiryDate: new Date(2026, 7, 17),
        note: 'Activity extends expiry.',
        actionNeeded: 'Add activity before expiry.',
        quickActions: ['Shop through portal'],
      },
    ]);
    const component = createComponent();

    component.setHeldOnly(true);
    component.markAllToday();
    component.markAllToday();

    expect(expiry.setLastActivity).toHaveBeenCalledOnceWith('united_mp', component.todayStr);

    tick(3000);
  }));

  it('resets the bulk confirmation when the user waits', fakeAsync(() => {
    const component = createComponent();

    component.markAllToday();
    tick(3000);

    expect(component.bulkConfirm()).toBeFalse();
    expect(expiry.setLastActivity).not.toHaveBeenCalled();
  }));

  it('clears bulk timers when destroyed', fakeAsync(() => {
    const component = createComponent();

    component.markAllToday();
    fixture.destroy();
    tick(3000);

    expect(component.bulkConfirm()).toBeTrue();
    expect(expiry.setLastActivity).not.toHaveBeenCalled();
  }));
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ExpiryService, ExpiryStatus } from '../../core/services/expiry.service';
import { PreferencesService } from '../../core/services/preferences.service';
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

class MockPreferencesService {
  preferences = signal({ heldProgramIds: [] as string[] });
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
  let prefs: MockPreferencesService;

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
    prefs = new MockPreferencesService();
    expiry.statuses.set(statuses);
    wallet.balances.set('united_mp', 10000);

    await TestBed.configureTestingModule({
      imports: [ExpiryComponent],
      providers: [
        { provide: ExpiryService, useValue: expiry },
        { provide: WalletService, useValue: wallet },
        { provide: PreferencesService, useValue: prefs },
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

  it('exposes Mine filter and bulk confirmation state to assistive tech', () => {
    const component = createComponent();
    let mineButton = fixture.nativeElement.querySelector('.filter-held-btn') as HTMLButtonElement;
    const bulkButton = fixture.nativeElement.querySelector('.bulk-today-btn') as HTMLButtonElement;

    expect(mineButton.getAttribute('aria-pressed')).toBe('false');
    expect(bulkButton.getAttribute('aria-label')).toContain('Mark all visible expirable programs');

    component.setHeldOnly(true);
    fixture.detectChanges();
    mineButton = fixture.nativeElement.querySelector('.filter-held-btn') as HTMLButtonElement;

    expect(mineButton.getAttribute('aria-pressed')).toBe('true');
    expect(bulkButton.getAttribute('aria-label')).toContain('Mark my visible expirable programs');

    component.markAllToday();
    fixture.detectChanges();

    expect(bulkButton.getAttribute('aria-label')).toContain('Confirm marking visible expirable programs');
  });

  it('clears activity when the native date input is emptied', () => {
    const component = createComponent();
    const input = document.createElement('input');
    input.value = '';

    component.onDateChange('united_mp', { target: input } as unknown as Event);

    expect(expiry.clearActivity).toHaveBeenCalledOnceWith('united_mp');
  });

  it('associates each activity date label with its date input', () => {
    const component = createComponent();
    const inputId = component.activityInputId('united_mp');

    const label = fixture.nativeElement.querySelector(`label[for="${inputId}"]`) as HTMLLabelElement;
    const input = fixture.nativeElement.querySelector(`#${inputId}`) as HTMLInputElement;

    expect(label?.textContent?.trim()).toBe('Last activity date');
    expect(input?.type).toBe('date');
    expect(input.getAttribute('aria-label')).toContain('United MileagePlus');
  });

  it('sanitizes activity input ids for unusual program identifiers', () => {
    const component = createComponent();

    expect(component.activityInputId('Program / With Spaces!')).toBe('expiry-last-activity-program-with-spaces');
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

  it('derives alert and export counts from the Mine-filtered statuses', () => {
    expiry.statuses.set([
      ...statuses,
      {
        cardId: 'aa_aadvantage',
        programName: 'American AAdvantage',
        daysRemaining: 12,
        urgency: 'critical',
        expiryDate: new Date(2026, 7, 17),
        note: 'Activity extends expiry.',
        actionNeeded: 'Add activity before expiry.',
        quickActions: ['Shop through portal'],
      },
    ]);
    const component = createComponent();

    expect(component.visibleCriticalCount()).toBe(1);
    expect(component.calExportCount()).toBe(2);

    component.setHeldOnly(true);

    expect(component.visibleStatuses().map(s => s.cardId)).toEqual(['united_mp']);
    expect(component.visibleCriticalCount()).toBe(0);
    expect(component.calExportCount()).toBe(1);
  });

  it('labels Mine-filtered alerts and discloses hidden urgent programs', () => {
    expiry.statuses.set([
      ...statuses,
      {
        cardId: 'aa_aadvantage',
        programName: 'American AAdvantage',
        daysRemaining: 12,
        urgency: 'critical',
        expiryDate: new Date(2026, 7, 17),
        note: 'Activity extends expiry.',
        actionNeeded: 'Add activity before expiry.',
        quickActions: ['Shop through portal'],
      },
    ]);
    const component = createComponent();

    component.setHeldOnly(true);
    fixture.detectChanges();

    const safeTitle = fixture.nativeElement.querySelector('.alert-banner.safe .alert-title') as HTMLElement;
    const hiddenNote = fixture.nativeElement.querySelector('.hidden-alert-note') as HTMLElement;

    expect(safeTitle.textContent?.trim()).toBe('My programs are in good shape');
    expect(hiddenNote.textContent).toContain('1 hidden program outside Mine');
  });

  it('bulk marks only missing activity dates', fakeAsync(() => {
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
    expiry.records.set({ united_mp: { cardId: 'united_mp', lastActivityDate: '2026-01-01' } });
    const component = createComponent();

    component.markAllToday();
    component.markAllToday();

    expect(expiry.setLastActivity).toHaveBeenCalledOnceWith('aa_aadvantage', component.todayStr);

    tick(3000);
  }));

  it('includes held zero-balance programs in Mine', () => {
    prefs.preferences.set({ heldProgramIds: ['amex_mr'] });
    const component = createComponent();

    component.setHeldOnly(true);

    expect(component.visibleStatuses().map(s => s.cardId)).toEqual(['amex_mr', 'united_mp']);
  });

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

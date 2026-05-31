import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataService } from '../../core/services/data.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { WalletService } from '../../core/services/wallet.service';
import { CardsComponent } from './cards.component';

class MockWalletService {
  hasAnyPoints = signal(false);
  balances = new Map<string, number>();
  getBalance(cardId: string): number {
    return this.balances.get(cardId) ?? 0;
  }
}

class MockPreferencesService {
  preferences = signal({ heldProgramIds: [] as string[] });
  updatePreferences = jasmine.createSpy('updatePreferences');
}

describe('CardsComponent', () => {
  const UI_KEY = 'tally_cards_ui_v1';
  const SEARCH_KEY = 'tally_cards_search_session_v1';
  let fixture: ComponentFixture<CardsComponent>;
  let prefs: MockPreferencesService;
  let wallet: MockWalletService;

  const cards = [
    {
      id: 'amex_mr',
      name: 'Amex Membership Rewards',
      short: 'Amex MR',
      icon: 'AM',
      color: '#1a7a4a',
      textColor: '#fff',
      cards: ['Amex Gold'],
      baseCpp: 1.6,
      category: 'transferable',
      partners: [{ name: 'Air Canada Aeroplan', icon: 'AC', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.1 }],
    },
    {
      id: 'hyatt',
      name: 'World of Hyatt',
      short: 'Hyatt',
      icon: 'HY',
      color: '#b45309',
      textColor: '#fff',
      cards: ['World of Hyatt Card'],
      baseCpp: 1.8,
      category: 'hotel',
      partners: [{ name: 'Hyatt', icon: 'HY', ratio: '1:1', type: 'hotel', quality: 'good', cpp: 1.8 }],
    },
  ];

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    prefs = new MockPreferencesService();
    wallet = new MockWalletService();

    await TestBed.configureTestingModule({
      imports: [CardsComponent],
      providers: [
        { provide: WalletService, useValue: wallet },
        { provide: PreferencesService, useValue: prefs },
        { provide: DataService, useValue: { cards, transferBonuses: [] } },
      ],
    }).compileComponents();
  });

  function createComponent(): CardsComponent {
    fixture = TestBed.createComponent(CardsComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('restores durable filters from localStorage and transient search from sessionStorage', () => {
    localStorage.setItem(UI_KEY, JSON.stringify({
      activeCat: 'hotel',
      cardSort: 'cpp',
      greatOnly: true,
      showHeldOnly: true,
    }));
    sessionStorage.setItem(SEARCH_KEY, 'hyatt');

    const component = createComponent();

    expect(component.activeCat()).toBe('hotel');
    expect(component.cardSort()).toBe('cpp');
    expect(component.greatOnly()).toBeTrue();
    expect(component.showHeldOnly()).toBeTrue();
    expect(component.searchRaw()).toBe('hyatt');
  });

  it('ignores invalid stored filters and does not apply Mine when wallet is empty', () => {
    localStorage.setItem(UI_KEY, JSON.stringify({
      activeCat: 'bogus',
      cardSort: 'nope',
      showHeldOnly: true,
    }));

    const component = createComponent();

    expect(component.activeCat()).toBe('all');
    expect(component.cardSort()).toBe('default');
    expect(component.showHeldOnly()).toBeTrue();
    expect(component.filteredCards().length).toBe(2);
  });

  it('includes held zero-balance programs in the Mine filter', () => {
    prefs.preferences.set({ heldProgramIds: ['hyatt'] });
    localStorage.setItem(UI_KEY, JSON.stringify({ showHeldOnly: true }));

    const component = createComponent();

    expect(component.filteredCards().map(card => card.id)).toEqual(['hyatt']);
  });

  it('labels zero-balance held programs in the card list', () => {
    prefs.preferences.set({ heldProgramIds: ['hyatt'] });

    createComponent();

    const savedPills = Array.from(fixture.nativeElement.querySelectorAll('.cc-saved-pill') as NodeListOf<HTMLElement>)
      .map(node => node.textContent?.trim());
    expect(savedPills).toContain('Saved program');
  });

  it('saves zero-balance programs from Cards without changing balances', () => {
    const component = createComponent();

    component.toggleHeldProgram('hyatt');

    expect(prefs.updatePreferences).toHaveBeenCalledWith({ heldProgramIds: ['hyatt'] });
  });

  it('renders balance-backed saved state as a status instead of a focusable save button', () => {
    wallet.balances.set('hyatt', 10000);

    createComponent();

    const status = fixture.nativeElement.querySelector('.cc-save-status');
    expect(status?.textContent).toContain('Balance saved');
    expect(fixture.nativeElement.querySelector('button.balance-backed')).toBeNull();
  });

  it('wires calculator and transfer finder labels to their controls', () => {
    const component = createComponent();
    component.showRater.set(true);
    component.showCalc.set(true);
    component.showTransferFinder.set(true);

    fixture.detectChanges();

    const labelledControlIds = [
      'cards-rater-points',
      'cards-rater-cash',
      'cards-calc-points',
      'cards-transfer-target',
      'cards-transfer-needed',
    ];
    for (const id of labelledControlIds) {
      expect(fixture.nativeElement.querySelector(`label[for="${id}"]`)).not.toBeNull();
      expect(fixture.nativeElement.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('wires expandable Cards sections to controlled panels', () => {
    wallet.hasAnyPoints.set(true);
    wallet.balances.set('amex_mr', 10000);
    const component = createComponent();
    component.showSpendRec.set(true);
    component.showReachable.set(true);
    component.showRater.set(true);
    component.showCalc.set(true);
    component.showTransferFinder.set(true);
    component.toggleCard('amex_mr');
    component.togglePartnerDetail('amex_mr', 'Air Canada Aeroplan');

    fixture.detectChanges();

    const controlledIds = [
      'cards-spend-recommendations',
      'cards-reachable-partners',
      'cards-redemption-rater',
      'cards-points-value-calculator',
      'cards-transfer-route-finder',
      component.cardPanelId('amex_mr'),
      component.partnerPanelId('amex_mr', 'Air Canada Aeroplan'),
    ];
    for (const id of controlledIds) {
      expect(fixture.nativeElement.querySelector(`[aria-controls="${id}"]`)).not.toBeNull();
      expect(fixture.nativeElement.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('exposes mutually exclusive filters as radio groups while preserving true toggles', () => {
    const component = createComponent();
    component.showSpendRec.set(true);

    fixture.detectChanges();

    const categoryGroup = fixture.nativeElement.querySelector('.filter-row');
    const categoryOptions = Array.from<HTMLElement>(categoryGroup.querySelectorAll('.filter-btn:not(.great-toggle):not(.mine-toggle)'));
    expect(categoryGroup.getAttribute('role')).toBe('radiogroup');
    expect(categoryOptions.every(option => option.getAttribute('role') === 'radio')).toBeTrue();
    expect(categoryOptions.map(option => option.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false', 'false']);
    expect(categoryOptions.some(option => option.hasAttribute('aria-pressed'))).toBeFalse();

    const sortGroup = fixture.nativeElement.querySelector('.sort-row');
    const sortOptions = Array.from<HTMLElement>(sortGroup.querySelectorAll('.sort-btn'));
    expect(sortGroup.getAttribute('role')).toBe('radiogroup');
    expect(sortOptions.every(option => option.getAttribute('role') === 'radio')).toBeTrue();
    expect(sortOptions.filter(option => option.getAttribute('aria-checked') === 'true').length).toBe(1);
    expect(sortOptions.some(option => option.hasAttribute('aria-pressed'))).toBeFalse();

    const spendGroup = fixture.nativeElement.querySelector('.spend-cat-row');
    const spendOptions = Array.from<HTMLElement>(spendGroup.querySelectorAll('.spend-cat-btn'));
    expect(spendGroup.getAttribute('role')).toBe('radiogroup');
    expect(spendOptions.every(option => option.getAttribute('role') === 'radio')).toBeTrue();
    expect(spendOptions.map(option => option.getAttribute('aria-checked'))[0]).toBe('true');
    expect(spendOptions.some(option => option.hasAttribute('aria-pressed'))).toBeFalse();

    expect(fixture.nativeElement.querySelector('.great-toggle')?.hasAttribute('aria-pressed')).toBeTrue();
  });

  it('writes filter state durably and removes empty session search', () => {
    const component = createComponent();

    component.activeCat.set('transferable');
    component.cardSort.set('balance');
    component.searchRaw.set('amex');
    TestBed.flushEffects();

    expect(JSON.parse(localStorage.getItem(UI_KEY) ?? '{}')).toEqual({
      activeCat: 'transferable',
      cardSort: 'balance',
      greatOnly: false,
      showHeldOnly: false,
    });
    expect(sessionStorage.getItem(SEARCH_KEY)).toBe('amex');

    component.searchRaw.set('');
    TestBed.flushEffects();

    expect(sessionStorage.getItem(SEARCH_KEY)).toBeNull();
  });
});

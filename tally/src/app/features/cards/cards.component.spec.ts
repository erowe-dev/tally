import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DataService } from '../../core/services/data.service';
import { PreferencesService } from '../../core/services/preferences.service';
import { WalletService } from '../../core/services/wallet.service';
import { CardsComponent } from './cards.component';

class MockWalletService {
  hasAnyPoints = signal(false);
  getBalance(_cardId: string): number {
    return 0;
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

    await TestBed.configureTestingModule({
      imports: [CardsComponent],
      providers: [
        { provide: WalletService, useValue: new MockWalletService() },
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
    expect(savedPills).toContain('Saved in wallet');
  });

  it('saves zero-balance programs from Cards without changing balances', () => {
    const component = createComponent();

    component.toggleHeldProgram('hyatt');

    expect(prefs.updatePreferences).toHaveBeenCalledWith({ heldProgramIds: ['hyatt'] });
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

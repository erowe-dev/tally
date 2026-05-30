import { Component, Input, Output, EventEmitter, Type, signal } from '@angular/core';
import { ComponentFixture, DeferBlockState, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SwUpdate } from '@angular/service-worker';
import { AppComponent } from './app.component';
import { WalletService } from './core/services/wallet.service';
import { ExpiryService } from './core/services/expiry.service';
import { AuthService } from './core/services/auth.service';
import { NetworkService } from './core/services/network.service';
import { NavigationService } from './core/services/navigation.service';
import { AnalyticsService } from './core/services/analytics.service';
import { NavTab } from './core/models';
import { TallyLogoComponent } from './shared/components/tally-logo/tally-logo.component';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { OptimizerComponent } from './features/optimizer/optimizer.component';
import { WalletComponent } from './features/wallet/wallet.component';
import { CardsComponent } from './features/cards/cards.component';
import { SweetspotsComponent } from './features/sweetspots/sweetspots.component';
import { ExpiryComponent } from './features/expiry/expiry.component';

@Component({ selector: 'tally-logo', standalone: true, template: '' })
class StubLogoComponent {
  @Input() size?: string;
  @Input() showText?: boolean;
}

@Component({ selector: 'tally-bottom-nav', standalone: true, template: '' })
class StubBottomNavComponent {
  @Input() activeTab?: NavTab;
  @Output() tabChange = new EventEmitter<NavTab>();
}

@Component({ selector: 'tally-toast', standalone: true, template: '' })
class StubToastComponent {}

@Component({ selector: 'tally-optimizer', standalone: true, template: '' })
class StubOptimizerComponent {
  @Input() prefill: unknown;
}

@Component({ selector: 'tally-wallet', standalone: true, template: '' })
class StubWalletComponent {}

@Component({ selector: 'tally-cards', standalone: true, template: '' })
class StubCardsComponent {}

@Component({ selector: 'tally-sweetspots', standalone: true, template: '' })
class StubSweetspotsComponent {}

@Component({ selector: 'tally-expiry', standalone: true, template: '' })
class StubExpiryComponent {}

class MockWalletService {
  hasAnyPoints = signal(false);
  totalPoints = signal(0);
}

class MockExpiryService {
  criticalCount = signal(0);
}

class MockAuthService {
  isAuthenticated = signal(false);
  isLoading = signal(false);
  isResolved = signal(true);
  user = signal<{ name?: string; email?: string; picture?: string } | null>(null);
  login = jasmine.createSpy('login');
  logout = jasmine.createSpy('logout');
}

class MockNetworkService {
  isOnline = signal(true);
}

class MockNavigationService {
  pending = signal<{ tab: NavTab; optimizerPrefill?: unknown } | null>(null);
  clear(): void {
    this.pending.set(null);
  }
}

class MockAnalyticsService {
  track = jasmine.createSpy('track');
}

describe('AppComponent', () => {
  const navTabs: NavTab[] = ['optimizer', 'wallet', 'cards', 'sweetspots', 'expiry'];
  const publicTabs: NavTab[] = ['cards', 'sweetspots'];
  const protectedTabs: NavTab[] = ['optimizer', 'wallet', 'expiry'];
  const componentByTab: Record<NavTab, Type<unknown>> = {
    optimizer: StubOptimizerComponent,
    wallet: StubWalletComponent,
    cards: StubCardsComponent,
    sweetspots: StubSweetspotsComponent,
    expiry: StubExpiryComponent,
  };

  let auth: MockAuthService;
  let wallet: MockWalletService;
  let expiry: MockExpiryService;
  let analytics: MockAnalyticsService;

  beforeEach(async () => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    auth = new MockAuthService();
    wallet = new MockWalletService();
    expiry = new MockExpiryService();
    analytics = new MockAnalyticsService();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: WalletService, useValue: wallet },
        { provide: ExpiryService, useValue: expiry },
        { provide: NetworkService, useValue: new MockNetworkService() },
        { provide: NavigationService, useValue: new MockNavigationService() },
        { provide: AnalyticsService, useValue: analytics },
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: { subscribe: () => ({ unsubscribe() {} }) } } },
      ],
    })
      .overrideComponent(AppComponent, {
        remove: {
          imports: [
            TallyLogoComponent,
            BottomNavComponent,
            ToastComponent,
            OptimizerComponent,
            WalletComponent,
            CardsComponent,
            SweetspotsComponent,
            ExpiryComponent,
          ],
        },
        add: {
          imports: [
            StubLogoComponent,
            StubBottomNavComponent,
            StubToastComponent,
            StubOptimizerComponent,
            StubWalletComponent,
            StubCardsComponent,
            StubSweetspotsComponent,
            StubExpiryComponent,
          ],
        },
      })
      .compileComponents();
  });

  async function renderDeferredContent(fixture: ComponentFixture<AppComponent>): Promise<void> {
    fixture.detectChanges();
    const deferBlocks = await fixture.getDeferBlocks();
    await Promise.all(deferBlocks.map(block => block.render(DeferBlockState.Complete)));
    fixture.detectChanges();
  }

  function expectOnlyTabStub(fixture: ComponentFixture<AppComponent>, tab: NavTab): void {
    navTabs.forEach(candidate => {
      const match = fixture.debugElement.query(By.directive(componentByTab[candidate]));
      if (candidate === tab) {
        expect(match).withContext(`${candidate} stub visibility`).not.toBeNull();
      } else {
        expect(match).withContext(`${candidate} stub visibility`).toBeNull();
      }
    });
  }

  it('creates the app shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  publicTabs.forEach(tab => {
    it(`renders the public ${tab} tab when signed out`, async () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.componentInstance.handleTabChange(tab);
      await renderDeferredContent(fixture);

      expect(fixture.componentInstance.activeTab()).toBe(tab);
      expectOnlyTabStub(fixture, tab);
      expect(fixture.nativeElement.querySelector('.login-prompt')).toBeNull();
    });
  });

  protectedTabs.forEach(tab => {
    it(`shows the login prompt for the protected ${tab} tab when signed out`, async () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.componentInstance.handleTabChange(tab);
      await renderDeferredContent(fixture);

      expect(fixture.componentInstance.activeTab()).toBe(tab);
      expect(fixture.nativeElement.querySelector('.login-title')?.textContent).toContain('Sign in to continue');
      expect(fixture.debugElement.query(By.directive(componentByTab[tab]))).toBeNull();
    });
  });

  protectedTabs.forEach(tab => {
    it(`renders the signed-in deferred ${tab} tab stub`, async () => {
      auth.isAuthenticated.set(true);

      const fixture = TestBed.createComponent(AppComponent);
      fixture.componentInstance.handleTabChange(tab);
      await renderDeferredContent(fixture);

      expect(fixture.componentInstance.activeTab()).toBe(tab);
      expectOnlyTabStub(fixture, tab);
      expect(fixture.nativeElement.querySelector('.login-prompt')).toBeNull();
    });
  });

  navTabs.forEach(tab => {
    it(`switches activeTab to ${tab} from the bottom-nav output`, () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      const bottomNav = fixture.debugElement.query(By.directive(StubBottomNavComponent));
      const bottomNavComponent = bottomNav.componentInstance as StubBottomNavComponent;
      bottomNavComponent.tabChange.emit(tab);
      fixture.detectChanges();

      expect(fixture.componentInstance.activeTab()).toBe(tab);
    });
  });

  [
    { key: '1', tab: 'optimizer' },
    { key: '2', tab: 'wallet' },
    { key: '3', tab: 'cards' },
    { key: '4', tab: 'sweetspots' },
    { key: '5', tab: 'expiry' },
  ].forEach(({ key, tab }) => {
    it(`switches to ${tab} from keyboard shortcut ${key}`, () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      document.dispatchEvent(new KeyboardEvent('keydown', { key }));
      fixture.detectChanges();

      expect(fixture.componentInstance.activeTab()).toBe(tab as NavTab);
    });
  });

  it('shows the login prompt on a protected tab when signed out', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.handleTabChange('wallet');
    fixture.detectChanges();

    const loginTitle = fixture.nativeElement.querySelector('.login-title') as HTMLElement | null;
    expect(loginTitle?.textContent).toContain('Sign in to continue');
  });

  it('shows authenticated header state and sign-out when signed in', () => {
    auth.isAuthenticated.set(true);
    auth.user.set({ name: 'Erin', email: 'erin@example.com' });
    wallet.hasAnyPoints.set(true);
    wallet.totalPoints.set(42000);

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.pts-value')?.textContent).toContain('42,000');

    const signOut = fixture.debugElement.query(By.css('.sign-out-btn'));
    signOut.triggerEventHandler('click');
    expect(auth.logout).toHaveBeenCalled();
  });

  it('persists the selected public tab and restores it on the next app instance', () => {
    let fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.handleTabChange('sweetspots');
    fixture.detectChanges();

    expect(localStorage.getItem('tally_active_tab_v1')).toBe('sweetspots');

    fixture.destroy();
    fixture = TestBed.createComponent(AppComponent);

    expect(fixture.componentInstance.activeTab()).toBe('sweetspots');
  });

  it('syncs tab changes into the URL for reloads and sharing', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    fixture.componentInstance.handleTabChange('sweetspots');

    expect(window.location.search).toBe('?tab=sweetspots');
  });

  it('honors a valid tab from the URL on startup', () => {
    window.history.replaceState(null, '', '/?tab=sweetspots');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('sweetspots');
    expect(analytics.track).not.toHaveBeenCalledWith('tab_viewed', jasmine.anything());
  });

  it('uses browser back and forward state to change tabs', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.handleTabChange('sweetspots');
    fixture.detectChanges();

    window.history.pushState({ tallyTab: 'cards' }, '', '/?tab=cards');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(fixture.componentInstance.activeTab()).toBe('cards');
  });

  it('restores a protected tab as sign-in intent when signed out', () => {
    localStorage.setItem('tally_active_tab_v1', 'wallet');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('wallet');
    expect(fixture.nativeElement.querySelector('.login-title')?.textContent).toContain('Sign in to continue');
  });

  it('restores each tab to its remembered scroll position', fakeAsync(() => {
    const scrollToSpy = spyOn(window, 'scrollTo');
    spyOnProperty(window, 'scrollY', 'get').and.returnValues(360, 920, 920);

    const fixture = TestBed.createComponent(AppComponent);
    tick();

    fixture.componentInstance.handleTabChange('sweetspots');
    tick();
    expect(scrollToSpy.calls.mostRecent().args[0] as unknown).toEqual({ top: 0, left: 0, behavior: 'auto' });

    fixture.componentInstance.handleTabChange('cards');
    tick();
    expect(scrollToSpy.calls.mostRecent().args[0] as unknown).toEqual({ top: 360, left: 0, behavior: 'auto' });
  }));

  it('scrolls the active tab to top when selected again', fakeAsync(() => {
    const scrollToSpy = spyOn(window, 'scrollTo');
    const fixture = TestBed.createComponent(AppComponent);
    tick();

    fixture.componentInstance.handleTabChange('cards');
    tick();

    expect(scrollToSpy.calls.mostRecent().args[0] as unknown).toEqual({ top: 0, left: 0, behavior: 'auto' });
  }));
});

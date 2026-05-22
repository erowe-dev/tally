import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SwUpdate } from '@angular/service-worker';
import { AppComponent } from './app.component';
import { WalletService } from './core/services/wallet.service';
import { ExpiryService } from './core/services/expiry.service';
import { AuthService } from './core/services/auth.service';
import { NetworkService } from './core/services/network.service';
import { NavigationService } from './core/services/navigation.service';
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

describe('AppComponent', () => {
  let auth: MockAuthService;
  let wallet: MockWalletService;
  let expiry: MockExpiryService;

  beforeEach(async () => {
    auth = new MockAuthService();
    wallet = new MockWalletService();
    expiry = new MockExpiryService();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: WalletService, useValue: wallet },
        { provide: ExpiryService, useValue: expiry },
        { provide: NetworkService, useValue: new MockNetworkService() },
        { provide: NavigationService, useValue: new MockNavigationService() },
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

  it('creates the app shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
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
});

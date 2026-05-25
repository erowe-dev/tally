import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';
import { ExpiryService } from '../../../core/services/expiry.service';
import { NavTab } from '../../../core/models';
import { BottomNavComponent } from './bottom-nav.component';

class MockAuthService {
  isAuthenticated = signal(false);
}

class MockExpiryService {
  criticalCount = signal(0);
}

class MockDataService {
  transferBonuses = [];
}

describe('BottomNavComponent', () => {
  let fixture: ComponentFixture<BottomNavComponent>;
  let component: BottomNavComponent;
  let auth: MockAuthService;

  beforeEach(async () => {
    auth = new MockAuthService();

    await TestBed.configureTestingModule({
      imports: [BottomNavComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ExpiryService, useValue: new MockExpiryService() },
        { provide: DataService, useValue: new MockDataService() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BottomNavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function buttons(): HTMLButtonElement[] {
    return fixture.debugElement
      .queryAll(By.css('.nav-btn'))
      .map(debugEl => debugEl.nativeElement as HTMLButtonElement);
  }

  it('renders five navigation buttons inside a labelled nav', () => {
    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement;

    expect(nav.getAttribute('aria-label')).toBe('Primary app navigation');
    expect(buttons().map(button => button.querySelector('.nav-label')?.textContent?.trim())).toEqual([
      'Optimize',
      'Wallet',
      'Cards',
      'Spots',
      'Expiry',
    ]);
  });

  it('emits the matching tab id when each button is clicked', () => {
    const emitted: NavTab[] = [];
    component.tabChange.subscribe(tab => emitted.push(tab));

    buttons().forEach(button => button.click());

    expect(emitted).toEqual(['optimizer', 'wallet', 'cards', 'sweetspots', 'expiry']);
  });

  it('sets aria-current only on the active tab', () => {
    component.activeTab = 'sweetspots';
    fixture.detectChanges();

    const current = buttons().filter(button => button.getAttribute('aria-current') === 'page');

    expect(current.length).toBe(1);
    expect(current[0].getAttribute('aria-label')).toBe('Spots tab');
  });

  it('labels locked protected tabs as sign-in required when signed out', () => {
    expect(buttons().map(button => button.getAttribute('aria-label'))).toEqual([
      'Optimize tab, sign-in required',
      'Wallet tab, sign-in required',
      'Cards tab',
      'Spots tab',
      'Expiry tab, sign-in required',
    ]);
  });

  it('removes locked labels from protected tabs when signed in', () => {
    auth.isAuthenticated.set(true);
    fixture.detectChanges();

    expect(buttons().map(button => button.getAttribute('aria-label'))).toEqual([
      'Optimize tab',
      'Wallet tab',
      'Cards tab',
      'Spots tab',
      'Expiry tab',
    ]);
  });
});

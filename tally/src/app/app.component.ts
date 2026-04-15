import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavTab } from './core/models';
import { WalletService } from './core/services/wallet.service';
import { ExpiryService } from './core/services/expiry.service';
import { AuthService } from './core/services/auth.service';
import { TallyLogoComponent } from './shared/components/tally-logo/tally-logo.component';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.component';
import { OptimizerComponent } from './features/optimizer/optimizer.component';
import { WalletComponent } from './features/wallet/wallet.component';
import { CardsComponent } from './features/cards/cards.component';
import { SweetspotsComponent } from './features/sweetspots/sweetspots.component';
import { ExpiryComponent } from './features/expiry/expiry.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    TallyLogoComponent,
    BottomNavComponent,
    OptimizerComponent,
    WalletComponent,
    CardsComponent,
    SweetspotsComponent,
    ExpiryComponent,
  ],
  template: `
    <div class="app-shell">

      <!-- Auth loading overlay — shown while Auth0 checks session on startup -->
      <div class="auth-loading" *ngIf="auth.isLoading()">
        <div class="auth-spinner"></div>
      </div>

      <header class="app-header">
        <tally-logo size="sm" [showText]="true" />
        <div class="header-right" *ngIf="auth.isAuthenticated() && wallet.hasAnyPoints()">
          <div class="pts-label">Total Points</div>
          <div class="pts-value">{{ wallet.totalPoints() | number }}</div>
        </div>
        <div class="header-right" *ngIf="auth.isAuthenticated() && !wallet.hasAnyPoints()">
          <div class="pts-label">Points Advisor</div>
        </div>
        <button class="sign-out-btn" *ngIf="auth.isAuthenticated()" (click)="auth.logout()">
          Sign out
        </button>
      </header>

      <main class="app-main">

        <!-- Protected tabs — only rendered when authenticated -->
        <tally-optimizer  *ngIf="activeTab() === 'optimizer'  && auth.isAuthenticated()" />
        <tally-wallet     *ngIf="activeTab() === 'wallet'     && auth.isAuthenticated()" />
        <tally-expiry     *ngIf="activeTab() === 'expiry'     && auth.isAuthenticated()" />

        <!-- Public tabs — always available -->
        <tally-cards      *ngIf="activeTab() === 'cards'" />
        <tally-sweetspots *ngIf="activeTab() === 'sweetspots'" />

        <!-- Login prompt — shown when on a protected tab but not yet signed in -->
        <div class="login-prompt"
          *ngIf="isProtectedTab(activeTab()) && !auth.isAuthenticated() && auth.isResolved()">
          <div class="login-icon">✦</div>
          <div class="login-title">Sign in to continue</div>
          <div class="login-sub">
            Wallet, Optimizer, and Expiry sync to your account across devices.
          </div>
          <button class="login-btn" (click)="auth.login()">Sign in / Create account</button>
          <div class="login-public-note">
            Just browsing?
            <button class="link-btn" (click)="activeTab.set('cards')">View Cards & Partners</button>
          </div>
        </div>

      </main>

      <tally-bottom-nav
        [activeTab]="activeTab()"
        (tabChange)="handleTabChange($event)"
      />

    </div>
  `,
  styles: [`
    .app-shell {
      max-width: 430px; margin: 0 auto;
      min-height: 100dvh; display: flex; flex-direction: column;
      background: var(--off);
    }

    /* Auth loading overlay */
    .auth-loading {
      position: fixed; inset: 0; background: var(--off);
      display: flex; align-items: center; justify-content: center; z-index: 999;
    }
    .auth-spinner {
      width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid var(--border); border-top-color: var(--tally-green);
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Header */
    .app-header {
      padding: calc(env(safe-area-inset-top,0px) + 14px) 20px 14px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border);
      background: rgba(247,246,243,0.92);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      position: sticky; top: 0; z-index: 100;
    }
    .header-right { text-align: right; flex: 1; }
    .pts-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.14em; color: var(--text3); text-transform: uppercase;
    }
    .pts-value {
      font-family: 'Geist Mono', monospace; font-size: 16px; color: var(--tally-green);
    }
    .sign-out-btn {
      background: none; border: 1px solid var(--border); border-radius: 7px;
      color: var(--text3); font-family: 'Geist', sans-serif; font-size: 11px;
      padding: 5px 10px; cursor: pointer; white-space: nowrap; margin-left: 10px;
      transition: all 0.15s;
    }
    .sign-out-btn:hover { border-color: var(--text2); color: var(--text2); }

    /* Main scroll area */
    .app-main {
      flex: 1; overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 72px);
    }
    .app-main::-webkit-scrollbar { display: none; }

    /* Login prompt */
    .login-prompt {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 14px; padding: 64px 32px 48px;
      text-align: center; min-height: 60vh;
    }
    .login-icon {
      font-size: 32px; color: var(--tally-green);
      font-family: 'Instrument Serif', serif;
    }
    .login-title {
      font-family: 'Instrument Serif', serif; font-size: 26px;
      color: var(--text); line-height: 1.2;
    }
    .login-sub {
      font-family: 'Geist', sans-serif; font-size: 14px;
      color: var(--text2); line-height: 1.6; max-width: 280px;
    }
    .login-btn {
      background: var(--tally-green); color: #fff;
      font-family: 'Geist', sans-serif; font-size: 15px; font-weight: 500;
      border: none; border-radius: 12px; padding: 14px 32px;
      cursor: pointer; transition: background 0.15s; width: 100%; max-width: 280px;
    }
    .login-btn:hover { background: var(--tally-green-mid); }
    .login-public-note {
      font-family: 'Geist', sans-serif; font-size: 13px; color: var(--text3);
      display: flex; align-items: center; gap: 4px;
    }
    .link-btn {
      background: none; border: none; color: var(--tally-green);
      font-family: 'Geist', sans-serif; font-size: 13px;
      cursor: pointer; text-decoration: underline; padding: 0;
    }
  `],
})
export class AppComponent {
  wallet = inject(WalletService);
  expiry = inject(ExpiryService);
  auth = inject(AuthService);

  activeTab = signal<NavTab>('cards'); // default to public tab

  private readonly PROTECTED_TABS = new Set<NavTab>(['optimizer', 'wallet', 'expiry']);

  isProtectedTab(tab: NavTab): boolean {
    return this.PROTECTED_TABS.has(tab);
  }

  handleTabChange(tab: NavTab): void {
    if (this.PROTECTED_TABS.has(tab) && !this.auth.isAuthenticated()) {
      // Show the login prompt inline rather than hard-redirecting —
      // user can still see what tab they tried to access
      this.activeTab.set(tab);
      return;
    }
    this.activeTab.set(tab);
  }
}

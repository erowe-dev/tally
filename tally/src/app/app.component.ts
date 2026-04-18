import { Component, signal, computed, inject, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavTab } from './core/models';
import { WalletService } from './core/services/wallet.service';
import { ExpiryService } from './core/services/expiry.service';
import { AuthService } from './core/services/auth.service';
import { NetworkService } from './core/services/network.service';
import { NavigationService } from './core/services/navigation.service';
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

      <!-- Offline banner -->
      <div class="offline-banner" *ngIf="!network.isOnline()">
        <span>⚡</span> You're offline — changes save locally and sync when you reconnect.
      </div>

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
        <div class="user-menu" *ngIf="auth.isAuthenticated()">
          <img
            *ngIf="auth.user()?.picture"
            [src]="auth.user()!.picture!"
            class="user-avatar"
            [title]="auth.user()?.email || ''"
            alt="Profile"
            referrerpolicy="no-referrer"
          />
          <div *ngIf="!auth.user()?.picture" class="user-avatar-fallback">
            {{ userInitial() }}
          </div>
          <button class="sign-out-btn" (click)="auth.logout()">Sign out</button>
        </div>
      </header>

      <!-- Expiry critical ribbon — shown when authenticated and any program needs urgent action -->
      <button class="expiry-ribbon"
        *ngIf="auth.isAuthenticated() && expiry.criticalCount() > 0 && activeTab() !== 'expiry'"
        (click)="activeTab.set('expiry')">
        <span class="expiry-ribbon-icon">⚠️</span>
        <span class="expiry-ribbon-text">
          {{ expiry.criticalCount() }} program{{ expiry.criticalCount() > 1 ? 's' : '' }}
          expiring soon — tap to review
        </span>
        <span class="expiry-ribbon-arrow">→</span>
      </button>

      <main class="app-main">

        <!-- Protected tabs — only rendered when authenticated -->
        <tally-optimizer  *ngIf="activeTab() === 'optimizer'  && auth.isAuthenticated()"
                          [prefill]="optimizerPrefill()" />
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

    /* Offline banner */
    .offline-banner {
      background: var(--tally-amber, #d97706); color: #fff;
      font-family: 'Geist', sans-serif; font-size: 12px;
      text-align: center; padding: 8px 16px;
      position: sticky; top: 0; z-index: 200;
      display: flex; align-items: center; justify-content: center; gap: 6px;
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
    .user-menu { display: flex; align-items: center; gap: 8px; margin-left: 10px; }
    .user-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      object-fit: cover; border: 1.5px solid var(--border);
      flex-shrink: 0;
    }
    .user-avatar-fallback {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--tally-green); color: white;
      font-family: 'Geist Mono', monospace; font-size: 11px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; border: 1.5px solid var(--border);
    }
    .sign-out-btn {
      background: none; border: 1px solid var(--border); border-radius: 7px;
      color: var(--text3); font-family: 'Geist', sans-serif; font-size: 11px;
      padding: 5px 10px; cursor: pointer; white-space: nowrap;
      transition: all 0.15s;
    }
    .sign-out-btn:hover { border-color: var(--text2); color: var(--text2); }

    /* Expiry critical ribbon */
    .expiry-ribbon {
      width: 100%; background: var(--tally-red-light, #fef2f2);
      border: none; border-bottom: 1px solid rgba(220,38,38,0.15);
      padding: 9px 16px; cursor: pointer;
      display: flex; align-items: center; gap: 8px;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.15s;
    }
    .expiry-ribbon:hover { background: rgba(254,226,226,0.9); }
    .expiry-ribbon-icon { font-size: 13px; flex-shrink: 0; }
    .expiry-ribbon-text {
      flex: 1; font-family: 'Geist', sans-serif; font-size: 12px;
      color: var(--tally-red, #dc2626); font-weight: 500; text-align: left;
    }
    .expiry-ribbon-arrow {
      font-size: 14px; color: var(--tally-red, #dc2626); flex-shrink: 0;
    }

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
  network = inject(NetworkService);
  private nav = inject(NavigationService);

  activeTab = signal<NavTab>('cards'); // default to public tab
  optimizerPrefill = signal<{ fromCity?: string; toCity?: string; cabin?: string } | null>(null);

  constructor() {
    // Watch for cross-component navigation requests (e.g. "Open in Optimizer" from Sweet Spots)
    effect(() => {
      const req = this.nav.pending();
      if (!req) return;
      this.handleTabChange(req.tab);
      if (req.optimizerPrefill) {
        this.optimizerPrefill.set(req.optimizerPrefill);
      }
      this.nav.clear();
    });
  }

  readonly userInitial = computed(() => {
    const u = this.auth.user();
    if (!u) return '?';
    const name = u.name ?? u.email ?? '';
    return name.charAt(0).toUpperCase() || '?';
  });

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

  private readonly TAB_ORDER: NavTab[] = ['optimizer', 'wallet', 'cards', 'sweetspots', 'expiry'];

  /** Keyboard shortcuts: 1–5 for tabs, Cmd/Ctrl+← / → for adjacent tabs */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Don't fire inside inputs/textareas
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

    const idx = this.TAB_ORDER.indexOf(this.activeTab());

    if (event.key >= '1' && event.key <= '5') {
      const tab = this.TAB_ORDER[parseInt(event.key) - 1];
      if (tab) this.handleTabChange(tab);
      return;
    }

    const isModified = event.metaKey || event.ctrlKey;
    if (isModified && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const dir = event.key === 'ArrowLeft' ? -1 : 1;
      const next = this.TAB_ORDER[(idx + dir + this.TAB_ORDER.length) % this.TAB_ORDER.length];
      if (next) this.handleTabChange(next);
    }
  }
}

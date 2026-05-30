import { Component, OnDestroy, signal, computed, inject, effect, PLATFORM_ID, isDevMode } from '@angular/core';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';
import { Subscription } from 'rxjs';
import { NavTab } from './core/models';
import { WalletService } from './core/services/wallet.service';
import { ExpiryService } from './core/services/expiry.service';
import { AuthService } from './core/services/auth.service';
import { NetworkService } from './core/services/network.service';
import { NavigationService } from './core/services/navigation.service';
import { AnalyticsService } from './core/services/analytics.service';
import { TallyLogoComponent } from './shared/components/tally-logo/tally-logo.component';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { OptimizerComponent } from './features/optimizer/optimizer.component';
import { WalletComponent } from './features/wallet/wallet.component';
import { CardsComponent } from './features/cards/cards.component';
import { SweetspotsComponent } from './features/sweetspots/sweetspots.component';
import { ExpiryComponent } from './features/expiry/expiry.component';

// PWA install prompt event type (not in the standard lib yet)
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const INSTALL_DISMISS_KEY = 'tally_install_dismissed_v1';
const ACTIVE_TAB_KEY = 'tally_active_tab_v1';

interface TabChangeOptions {
  restoreScroll?: boolean;
  syncUrl?: boolean;
  replaceUrl?: boolean;
  track?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  host: {
    '(document:keydown)': 'onKeyDown($event)',
  },
  imports: [
    CommonModule,
    TallyLogoComponent,
    BottomNavComponent,
    ToastComponent,
    OptimizerComponent,
    WalletComponent,
    CardsComponent,
    SweetspotsComponent,
    ExpiryComponent,
  ],
  template: `
    <div class="app-shell">

      <!-- PWA Install banner -->
      <div class="install-banner" *ngIf="showInstallBanner()">
        <span class="install-icon">📲</span>
        <div class="install-body">
          <div class="install-title">Add Tally to Home Screen</div>
          <div class="install-sub">Access your wallet offline, instantly</div>
        </div>
        <button type="button" class="install-btn" (click)="triggerInstall()">Install</button>
        <button type="button" class="install-dismiss" (click)="dismissInstall()" aria-label="Dismiss">✕</button>
      </div>

      <!-- SW update banner -->
      <div class="update-banner" *ngIf="showUpdateBanner()" aria-live="polite">
        <span class="update-icon">✦</span>
        <div class="update-body">
          <div class="update-title">Update available</div>
          <div class="update-sub">Reload to get the latest version</div>
        </div>
        <button type="button" class="update-btn" (click)="reloadPage()">Reload</button>
        <button type="button" class="update-dismiss" (click)="showUpdateBanner.set(false)" aria-label="Dismiss">✕</button>
      </div>

      <!-- Offline banner -->
      <div class="offline-banner" *ngIf="!network.isOnline()" aria-live="polite">
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
          <button type="button" class="sign-out-btn" (click)="auth.logout()">Sign out</button>
        </div>
      </header>

      <!-- Expiry critical ribbon — shown when authenticated and any program needs urgent action -->
      <button type="button" class="expiry-ribbon"
        *ngIf="auth.isAuthenticated() && expiry.criticalCount() > 0 && activeTab() !== 'expiry'"
        (click)="handleTabChange('expiry')">
        <span class="expiry-ribbon-icon">⚠️</span>
        <span class="expiry-ribbon-text">
          {{ expiry.criticalCount() }} program{{ expiry.criticalCount() > 1 ? 's' : '' }}
          expiring soon — tap to review
        </span>
        <span class="expiry-ribbon-arrow">→</span>
      </button>

      <main class="app-main">

        <!-- Protected tabs — loaded on demand after auth -->
        @defer (when activeTab() === 'optimizer' && auth.isAuthenticated()) {
          @if (activeTab() === 'optimizer' && auth.isAuthenticated()) {
            <tally-optimizer [prefill]="optimizerPrefill()" />
          }
        }

        @defer (when activeTab() === 'wallet' && auth.isAuthenticated()) {
          @if (activeTab() === 'wallet' && auth.isAuthenticated()) {
            <tally-wallet />
          }
        }

        @defer (when activeTab() === 'expiry' && auth.isAuthenticated()) {
          @if (activeTab() === 'expiry' && auth.isAuthenticated()) {
            <tally-expiry />
          }
        }

        <!-- Public tabs — loaded on demand -->
        @defer (when activeTab() === 'cards') {
          @if (activeTab() === 'cards') {
            <tally-cards />
          }
        }

        @defer (when activeTab() === 'sweetspots') {
          @if (activeTab() === 'sweetspots') {
            <tally-sweetspots />
          }
        }

        <!-- Login prompt — shown when on a protected tab but not yet signed in -->
        <div class="login-prompt"
          *ngIf="isProtectedTab(activeTab()) && !auth.isAuthenticated() && auth.isResolved()">
          <div class="login-icon">✦</div>
          <div class="login-title">Sign in to continue</div>
          <div class="login-sub">
            Wallet, Optimizer, and Expiry sync to your account across devices.
          </div>
          <button type="button" class="login-btn" (click)="auth.login()">Sign in / Create account</button>
          <div class="login-public-note">
            Just browsing?
            <button type="button" class="link-btn" (click)="handleTabChange('cards')">View Cards & Partners</button>
          </div>
        </div>

      </main>

      <tally-bottom-nav
        [activeTab]="activeTab()"
        (tabChange)="handleTabChange($event)"
      />

      <tally-toast />

    </div>
  `,
  styles: [`
    .app-shell {
      width: 100%; margin: 0 auto;
      min-height: 100dvh; display: flex; flex-direction: column;
      background: var(--off);
      --bottom-nav-clearance: calc(env(safe-area-inset-bottom, 0px) + 96px);
    }

    /* PWA Install banner */
    .install-banner {
      display: flex; align-items: center; gap: 10px;
      background: var(--tally-green-light); border-bottom: 1px solid rgba(26,122,74,0.2);
      padding: 10px 16px;
    }
    .install-icon { font-size: 18px; flex-shrink: 0; }
    .install-body { flex: 1; min-width: 0; }
    .install-title {
      font-family: 'Geist', sans-serif; font-size: 12px;
      font-weight: 600; color: var(--tally-green);
    }
    .install-sub {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--tally-green-mid, #2d8a5a); letter-spacing: 0.06em;
    }
    .install-btn {
      background: var(--tally-green); color: var(--on-accent); border: none; border-radius: 8px;
      font-family: 'Geist', sans-serif; font-size: 12px; font-weight: 500;
      padding: 8px 14px; min-height: 44px; cursor: pointer; flex-shrink: 0; transition: opacity 0.15s;
    }
    .install-btn:hover { opacity: 0.85; }
    .install-dismiss {
      background: none; border: none; color: var(--tally-green);
      font-size: 13px; cursor: pointer; padding: 4px; flex-shrink: 0; opacity: 0.6;
      line-height: 1; min-width: 44px; min-height: 44px; border-radius: 50%;
    }
    .install-dismiss:hover { opacity: 1; }

    /* SW update banner */
    .update-banner {
      display: flex; align-items: center; gap: 10px;
      background: var(--info-bg); border-bottom: 1px solid var(--info-border);
      padding: 10px 16px;
    }
    .update-icon { font-size: 16px; flex-shrink: 0; color: var(--info-text); }
    .update-body { flex: 1; min-width: 0; }
    .update-title {
      font-family: 'Geist', sans-serif; font-size: 12px;
      font-weight: 600; color: var(--info-text);
    }
    .update-sub {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--info-text); letter-spacing: 0.06em;
    }
    .update-btn {
      background: var(--info-text); color: var(--off); border: none; border-radius: 8px;
      font-family: 'Geist', sans-serif; font-size: 12px; font-weight: 500;
      padding: 6px 14px; cursor: pointer; flex-shrink: 0; transition: opacity 0.15s;
      min-height: 44px;
    }
    .update-btn:hover { opacity: 0.85; }
    .update-dismiss {
      background: none; border: none; color: var(--info-text);
      font-size: 13px; cursor: pointer; padding: 4px; flex-shrink: 0; opacity: 0.6;
      line-height: 1; min-width: 44px; min-height: 44px; border-radius: 50%;
    }
    .update-dismiss:hover { opacity: 1; }

    /* Offline banner */
    .offline-banner {
      background: var(--tally-amber); color: var(--off);
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
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      border-bottom: 1px solid var(--border);
      background: var(--shell-translucent);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      position: sticky; top: 0; z-index: 100;
    }
    .header-right { text-align: right; flex: 1; min-width: 0; }
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
      background: var(--tally-green); color: var(--on-accent);
      font-family: 'Geist Mono', monospace; font-size: 11px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; border: 1.5px solid var(--border);
    }
    .sign-out-btn {
      background: none; border: 1px solid var(--border); border-radius: 7px;
      color: var(--text3); font-family: 'Geist', sans-serif; font-size: 11px;
      min-height: 44px; padding: 8px 10px; cursor: pointer; white-space: nowrap;
      transition: all 0.15s;
    }
    .sign-out-btn:hover { border-color: var(--text2); color: var(--text2); }

    /* Expiry critical ribbon */
    .expiry-ribbon {
      width: 100%; background: var(--tally-red-light);
      border: none; border-bottom: 1px solid rgba(220,38,38,0.15);
      min-height: 48px; padding: 10px 16px; cursor: pointer;
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
      padding-bottom: var(--bottom-nav-clearance);
      scroll-padding-bottom: calc(var(--bottom-nav-clearance) + 24px);
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
      background: var(--tally-green); color: var(--on-accent);
      font-family: 'Geist', sans-serif; font-size: 15px; font-weight: 500;
      border: none; border-radius: 12px; padding: 14px 32px;
      cursor: pointer; transition: background 0.15s; width: 100%; max-width: 280px;
    }
    .login-btn:hover { background: var(--tally-green-mid); }
    .login-public-note {
      font-family: 'Geist', sans-serif; font-size: 13px; color: var(--text3);
      display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;
    }
    .link-btn {
      background: none; border: none; color: var(--tally-green);
      font-family: 'Geist', sans-serif; font-size: 13px;
      cursor: pointer; text-decoration: underline; padding: 8px 10px;
      min-height: 44px;
    }
    @media (max-width: 380px) {
      .app-header { padding-inline: 14px; }
      .pts-value { font-size: 14px; }
      .user-menu { gap: 6px; margin-left: 0; }
      .sign-out-btn { font-size: 10px; padding-inline: 8px; }
      .expiry-ribbon-text { font-size: 11px; }
    }
    @media (min-width: 760px) {
      .app-header {
        padding-inline: 32px;
      }
      .login-sub,
      .login-btn {
        max-width: 360px;
      }
    }
  `],
})
export class AppComponent implements OnDestroy {
  wallet = inject(WalletService);
  expiry = inject(ExpiryService);
  auth = inject(AuthService);
  network = inject(NetworkService);
  private nav = inject(NavigationService);
  private analytics = inject(AnalyticsService);
  private platformId = inject(PLATFORM_ID);
  private document = inject(DOCUMENT);
  private swUpdate = inject(SwUpdate, { optional: true });
  private browserWindow = isPlatformBrowser(this.platformId) ? this.document.defaultView : null;
  private swUpdateSub: Subscription | null = null;
  private readonly tabScrollPositions = new Map<NavTab, number>();
  private pendingScrollRestore: number | null = null;

  activeTab = signal<NavTab>('cards'); // default to public tab
  optimizerPrefill = signal<{ fromCity?: string; toCity?: string; cabin?: string } | null>(null);

  // PWA install prompt
  showInstallBanner = signal(false);
  private _deferredPrompt: BeforeInstallPromptEvent | null = null;

  // SW update banner
  showUpdateBanner = signal(false);

  private readonly onVisibilityChange = (): void => {
    if (this.document.visibilityState === 'visible') {
      this.checkForServiceWorkerUpdate();
    }
  };

  private readonly onBeforeInstallPrompt = (e: Event): void => {
    e.preventDefault(); // prevent the mini-infobar on mobile Chrome
    this._deferredPrompt = e as BeforeInstallPromptEvent;
    this.showInstallBanner.set(true);
  };

  private readonly onAppInstalled = (): void => {
    this.showInstallBanner.set(false);
    this._deferredPrompt = null;
  };

  private readonly onPopState = (): void => {
    const tab = this.getUrlTab() ?? 'cards';
    this.handleTabChange(tab, { syncUrl: false });
  };

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

    // Restore the last selected tab for a PWA-like return experience.
    const storedTab = this.safeLocalStorageGet(ACTIVE_TAB_KEY) as NavTab | null;
    if (storedTab && (this.TAB_ORDER as string[]).includes(storedTab)) {
      this.handleTabChange(storedTab, { restoreScroll: false, syncUrl: false, track: false });
    }

    // Honor ?tab= query param (used by PWA shortcuts in manifest), overriding stored state.
    const tabParam = this.getUrlTab();
    if (tabParam) {
      this.handleTabChange(tabParam, { restoreScroll: false, replaceUrl: true, track: false });
    }

    this.browserWindow?.addEventListener('popstate', this.onPopState);

    // SW update — show reload banner when a new version is available
    if (!isDevMode() && this.swUpdate?.isEnabled && this.browserWindow) {
      this.swUpdateSub = this.swUpdate.versionUpdates.subscribe(evt => {
        if (evt.type === 'VERSION_READY') this.showUpdateBanner.set(true);
      });
      this.checkForServiceWorkerUpdate();
      // Proactively check on tab focus
      this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    // PWA install prompt — only in browser, not SSR, not already standalone
    if (this.browserWindow && !this.browserWindow.matchMedia('(display-mode: standalone)').matches) {
      const dismissed = this.safeLocalStorageGet(INSTALL_DISMISS_KEY);
      const dismissedAt = dismissed ? parseInt(dismissed) : 0;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const canShow = Date.now() - dismissedAt > sevenDays;

      if (canShow) {
        this.browserWindow.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
        this.browserWindow.addEventListener('appinstalled', this.onAppInstalled);
      }
    }
  }

  ngOnDestroy(): void {
    this.swUpdateSub?.unsubscribe();
    if (this.pendingScrollRestore !== null) {
      this.browserWindow?.clearTimeout(this.pendingScrollRestore);
    }
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.browserWindow?.removeEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
    this.browserWindow?.removeEventListener('appinstalled', this.onAppInstalled);
    this.browserWindow?.removeEventListener('popstate', this.onPopState);
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

  triggerInstall(): void {
    if (!this._deferredPrompt) return;
    this._deferredPrompt.prompt();
    this._deferredPrompt.userChoice.then(() => {
      this._deferredPrompt = null;
      this.showInstallBanner.set(false);
    });
  }

  dismissInstall(): void {
    this.showInstallBanner.set(false);
    this.safeLocalStorageSet(INSTALL_DISMISS_KEY, Date.now().toString());
  }

  handleTabChange(tab: NavTab, options: TabChangeOptions = {}): void {
    const {
      restoreScroll = true,
      syncUrl = true,
      replaceUrl = false,
      track = true,
    } = options;

    if (tab === this.activeTab()) {
      if (restoreScroll) this.restoreTabScroll(tab, { forceTop: true });
      if (syncUrl) this.syncTabUrl(tab, { replace: true });
      return;
    }

    this.rememberActiveTabScroll();

    if (this.PROTECTED_TABS.has(tab) && !this.auth.isAuthenticated()) {
      // Show the login prompt inline rather than hard-redirecting —
      // user can still see what tab they tried to access
      this.activeTab.set(tab);
      this.safeLocalStorageSet(ACTIVE_TAB_KEY, tab);
      if (syncUrl) this.syncTabUrl(tab, { replace: replaceUrl });
      if (track) this.analytics.track('tab_viewed', { tab });
      if (restoreScroll) this.restoreTabScroll(tab);
      return;
    }
    this.activeTab.set(tab);
    this.safeLocalStorageSet(ACTIVE_TAB_KEY, tab);
    if (syncUrl) this.syncTabUrl(tab, { replace: replaceUrl });
    if (track) this.analytics.track('tab_viewed', { tab });
    if (restoreScroll) this.restoreTabScroll(tab);
  }

  private rememberActiveTabScroll(): void {
    if (!this.browserWindow) return;
    this.tabScrollPositions.set(this.activeTab(), this.browserWindow.scrollY);
  }

  private restoreTabScroll(tab: NavTab, options: { forceTop?: boolean } = {}): void {
    if (!this.browserWindow) return;
    if (this.pendingScrollRestore !== null) {
      this.browserWindow.clearTimeout(this.pendingScrollRestore);
    }

    const top = options.forceTop ? 0 : (this.tabScrollPositions.get(tab) ?? 0);
    this.pendingScrollRestore = this.browserWindow.setTimeout(() => {
      this.browserWindow?.scrollTo({ top, left: 0, behavior: 'auto' });
      this.pendingScrollRestore = null;
    });
  }

  private getUrlTab(): NavTab | null {
    const tab = new URLSearchParams(this.browserWindow?.location.search ?? '').get('tab') as NavTab | null;
    return tab && (this.TAB_ORDER as string[]).includes(tab) ? tab : null;
  }

  private syncTabUrl(tab: NavTab, options: { replace?: boolean } = {}): void {
    if (!this.browserWindow) return;

    const url = new URL(this.browserWindow.location.href);
    url.searchParams.set('tab', tab);
    const next = `${url.pathname}${url.search}${url.hash}`;
    if (next === `${this.browserWindow.location.pathname}${this.browserWindow.location.search}${this.browserWindow.location.hash}`) {
      return;
    }

    const method = options.replace ? 'replaceState' : 'pushState';
    this.browserWindow.history[method]({ tallyTab: tab }, '', next);
  }

  private readonly TAB_ORDER: NavTab[] = ['optimizer', 'wallet', 'cards', 'sweetspots', 'expiry'];

  /** Keyboard shortcuts: 1–5 for tabs, Cmd/Ctrl+← / → for adjacent tabs */
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

  reloadPage(): void {
    const reload = () => this.browserWindow?.location.reload();
    if (!isDevMode() && this.swUpdate?.isEnabled) {
      this.swUpdate.activateUpdate().then(reload).catch(reload);
      return;
    }
    reload();
  }

  private checkForServiceWorkerUpdate(): void {
    this.swUpdate?.checkForUpdate().catch(() => {});
  }

  private safeLocalStorageGet(key: string): string | null {
    try {
      return this.browserWindow?.localStorage.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private safeLocalStorageSet(key: string, value: string): void {
    try {
      this.browserWindow?.localStorage.setItem(key, value);
    } catch {
      // localStorage unavailable
    }
  }
}

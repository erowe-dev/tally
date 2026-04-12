import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavTab } from './core/models';
import { WalletService } from './core/services/wallet.service';
import { ExpiryService } from './core/services/expiry.service';
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

      <header class="app-header">
        <tally-logo size="sm" [showText]="true" />
        <div class="header-right" *ngIf="wallet.hasAnyPoints()">
          <div class="pts-label">Total Points</div>
          <div class="pts-value">{{ wallet.totalPoints() | number }}</div>
        </div>
        <div class="header-right" *ngIf="!wallet.hasAnyPoints()">
          <div class="pts-label">Points Advisor</div>
        </div>
      </header>

      <main class="app-main">
        <tally-optimizer  *ngIf="activeTab() === 'optimizer'" />
        <tally-wallet     *ngIf="activeTab() === 'wallet'" />
        <tally-cards      *ngIf="activeTab() === 'cards'" />
        <tally-sweetspots *ngIf="activeTab() === 'sweetspots'" />
        <tally-expiry     *ngIf="activeTab() === 'expiry'" />
      </main>

      <tally-bottom-nav
        [activeTab]="activeTab()"
        (tabChange)="activeTab.set($event)"
      />

    </div>
  `,
  styles: [`
    .app-shell {
      max-width: 430px; margin: 0 auto;
      min-height: 100dvh; display: flex; flex-direction: column;
      background: var(--off);
    }
    .app-header {
      padding: calc(env(safe-area-inset-top,0px) + 14px) 20px 14px;
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border);
      background: rgba(247,246,243,0.92);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      position: sticky; top: 0; z-index: 100;
    }
    .header-right { text-align: right; }
    .pts-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      letter-spacing: 0.14em; color: var(--text3); text-transform: uppercase;
    }
    .pts-value {
      font-family: 'Geist Mono', monospace; font-size: 16px; color: var(--tally-green);
    }
    .app-main {
      flex: 1; overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 72px);
    }
    .app-main::-webkit-scrollbar { display: none; }
  `]
})
export class AppComponent {
  activeTab = signal<NavTab>('optimizer');
  constructor(public wallet: WalletService, public expiry: ExpiryService) {}
}

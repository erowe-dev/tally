import { Component, Input, Output, EventEmitter, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavTab, TransferBonus } from '../../../core/models';
import { ExpiryService } from '../../../core/services/expiry.service';
import { AuthService } from '../../../core/services/auth.service';
import { DataService } from '../../../core/services/data.service';

interface NavItem { id: NavTab; label: string; icon: string; }

@Component({
  selector: 'tally-bottom-nav',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="bottom-nav" aria-label="Primary app navigation">
      <button
        type="button"
        *ngFor="let item of items"
        class="nav-btn"
        [class.active]="activeTab === item.id"
        [class.locked]="isLocked(item.id)"
        [attr.aria-current]="activeTab === item.id ? 'page' : null"
        [attr.aria-label]="getAriaLabel(item)"
        (click)="tabChange.emit(item.id)"
      >
        <span class="nav-icon-wrap" aria-hidden="true">
          <span class="nav-icon">{{ item.icon }}</span>
          <!-- Expiry critical count badge -->
          <span class="badge" *ngIf="item.id === 'expiry' && expiry.criticalCount() > 0 && auth.isAuthenticated()">
            {{ expiry.criticalCount() }}
          </span>
          <!-- Active transfer bonus dot on Spots tab -->
          <span class="bonus-dot" *ngIf="item.id === 'sweetspots' && activeBonusCount() > 0"></span>
          <!-- Lock indicator for protected tabs when unauthenticated -->
          <span class="lock-dot" *ngIf="isLocked(item.id)"></span>
        </span>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: relative; flex: 0 0 auto; width: 100%;
      background: var(--shell-translucent);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
      padding: 8px 8px calc(env(safe-area-inset-bottom, 0px) + 8px);
      display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
      z-index: 200;
      contain: layout paint;
    }
    .nav-btn {
      background: none; border: none;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      justify-content: center; cursor: pointer; padding: 6px 4px;
      min-width: 0; min-height: 52px;
      -webkit-tap-highlight-color: transparent;
      border-radius: 12px;
    }
    .nav-btn:focus-visible {
      outline: 2px solid var(--tally-green);
      outline-offset: 3px;
    }
    .nav-icon-wrap { position: relative; display: flex; justify-content: center; }
    .nav-icon { font-size: 20px; line-height: 1; }

    /* Expiry critical count badge */
    .badge {
      position: absolute; top: -4px; right: -8px;
      background: var(--tally-red); color: var(--on-accent);
      font-family: 'Geist Mono', monospace; font-size: 9px;
      width: 15px; height: 15px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }

    /* Active transfer bonus indicator on Spots tab */
    .bonus-dot {
      position: absolute; top: -2px; right: -6px;
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--tally-amber, #d97706); border: 1.5px solid var(--off, #f7f6f3);
    }

    /* Small dot on protected tabs when not signed in */
    .lock-dot {
      position: absolute; top: -2px; right: -6px;
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--border); border: 1.5px solid var(--off, #f7f6f3);
    }

    .nav-label {
      font-size: 9px; font-family: 'Geist Mono', monospace;
      letter-spacing: 0.08em; color: var(--text3); text-transform: uppercase;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; line-height: 1.2;
    }
    .nav-btn.active .nav-label { color: var(--tally-green); }
    .nav-btn.locked .nav-icon { opacity: 0.5; }
    .nav-btn.locked .nav-label { opacity: 0.5; }
    @media (min-width: 760px) {
      .bottom-nav {
        padding-inline: 24px;
      }
      .nav-btn {
        flex-direction: row;
        gap: 8px;
      }
      .nav-label {
        font-size: 10px;
      }
    }
  `],
})
export class BottomNavComponent {
  @Input() activeTab: NavTab = 'cards';
  @Output() tabChange = new EventEmitter<NavTab>();

  expiry = inject(ExpiryService);
  auth = inject(AuthService);
  private data = inject(DataService);

  readonly activeBonusCount = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.data.transferBonuses.filter((b: TransferBonus) => b.expires >= today).length;
  });

  private readonly PROTECTED: Set<NavTab> = new Set(['optimizer', 'wallet', 'expiry']);

  isLocked(tab: NavTab): boolean {
    return this.PROTECTED.has(tab) && !this.auth.isAuthenticated();
  }

  getAriaLabel(item: NavItem): string {
    return this.isLocked(item.id)
      ? `${item.label} tab, sign-in required`
      : `${item.label} tab`;
  }

  items: NavItem[] = [
    { id: 'optimizer',  label: 'Optimize', icon: '⚡' },
    { id: 'wallet',     label: 'Wallet',   icon: '💳' },
    { id: 'cards',      label: 'Cards',    icon: '🗂' },
    { id: 'sweetspots', label: 'Spots',    icon: '⭐' },
    { id: 'expiry',     label: 'Expiry',   icon: '🔔' },
  ];
}

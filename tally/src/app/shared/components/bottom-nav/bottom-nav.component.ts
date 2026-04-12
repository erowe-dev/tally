import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavTab } from '../../../core/models';
import { ExpiryService } from '../../../core/services/expiry.service';

interface NavItem { id: NavTab; label: string; icon: string; }

@Component({
  selector: 'tally-bottom-nav',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="bottom-nav">
      <button
        *ngFor="let item of items"
        class="nav-btn"
        [class.active]="activeTab === item.id"
        (click)="tabChange.emit(item.id)"
      >
        <span class="nav-icon-wrap">
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="badge" *ngIf="item.id === 'expiry' && expiry.criticalCount() > 0">
            {{ expiry.criticalCount() }}
          </span>
        </span>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </nav>
  `,
  styles: [`
    .bottom-nav {
      position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
      width: 100%; max-width: 430px;
      background: rgba(247,246,243,0.94);
      backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
      padding: 10px 0 calc(env(safe-area-inset-bottom, 0px) + 10px);
      display: flex; justify-content: space-around; z-index: 200;
    }
    .nav-btn {
      background: none; border: none;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      cursor: pointer; padding: 4px 10px;
      -webkit-tap-highlight-color: transparent;
    }
    .nav-icon-wrap { position: relative; display: flex; justify-content: center; }
    .nav-icon { font-size: 20px; line-height: 1; }
    .badge {
      position: absolute; top: -4px; right: -8px;
      background: var(--tally-red); color: white;
      font-family: 'Geist Mono', monospace; font-size: 9px;
      width: 15px; height: 15px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .nav-label {
      font-size: 9px; font-family: 'Geist Mono', monospace;
      letter-spacing: 0.08em; color: var(--text3); text-transform: uppercase;
    }
    .nav-btn.active .nav-label { color: var(--tally-green); }
  `]
})
export class BottomNavComponent {
  @Input() activeTab: NavTab = 'optimizer';
  @Output() tabChange = new EventEmitter<NavTab>();

  constructor(public expiry: ExpiryService) {}

  items: NavItem[] = [
    { id: 'optimizer',  label: 'Optimize', icon: '⚡' },
    { id: 'wallet',     label: 'Wallet',   icon: '💳' },
    { id: 'cards',      label: 'Cards',    icon: '🗂' },
    { id: 'sweetspots', label: 'Spots',    icon: '⭐' },
    { id: 'expiry',     label: 'Expiry',   icon: '🔔' },
  ];
}

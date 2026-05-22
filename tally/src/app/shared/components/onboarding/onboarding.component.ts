import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WalletService } from '../../../core/services/wallet.service';
import { ExpiryService } from '../../../core/services/expiry.service';

const ONBOARDED_KEY = 'tally_onboarded';
const OPTIMIZER_KEY = 'tally_optimizer_used';

@Component({
  selector: 'tally-onboarding',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="onboarding-panel" *ngIf="!dismissed()">
      <div class="ob-header">
        <span class="ob-title">Welcome to Tally ✦</span>
        <button class="ob-dismiss" (click)="dismiss()" aria-label="Dismiss">✕</button>
      </div>
      <div class="ob-sub">3 steps to get the most from your points</div>
      <div class="ob-steps">
        <div class="ob-step" [class.done]="step1()">
          <div class="ob-check">{{ step1() ? '✓' : '1' }}</div>
          <div class="ob-step-body">
            <div class="ob-step-title">Add your card balances</div>
            <div class="ob-step-sub">Enter points for each program below</div>
          </div>
        </div>
        <div class="ob-step" [class.done]="step2()">
          <div class="ob-check">{{ step2() ? '✓' : '2' }}</div>
          <div class="ob-step-body">
            <div class="ob-step-title">Set expiry dates</div>
            <div class="ob-step-sub">Track activity to protect your points</div>
          </div>
        </div>
        <div class="ob-step" [class.done]="step3()">
          <div class="ob-check">{{ step3() ? '✓' : '3' }}</div>
          <div class="ob-step-body">
            <div class="ob-step-title">Find a redemption</div>
            <div class="ob-step-sub">Use the Optimizer tab to find sweet spots</div>
          </div>
        </div>
      </div>
      <button class="ob-action" *ngIf="allDone()" (click)="dismiss()">
        All set — dismiss
      </button>
    </div>
  `,
  styles: [`
    .onboarding-panel {
      margin: 16px; padding: 16px;
      background: var(--tally-green-light); border-radius: 16px;
      border: 1px solid rgba(26,122,74,0.18);
    }
    .ob-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;
    }
    .ob-title {
      font-family: 'Instrument Serif', serif; font-size: 18px; color: var(--tally-green);
    }
    .ob-dismiss {
      background: none; border: none; color: var(--tally-green); opacity: 0.5;
      font-size: 14px; cursor: pointer; padding: 2px 4px; line-height: 1;
    }
    .ob-dismiss:hover { opacity: 1; }
    .ob-sub {
      font-family: 'Geist', sans-serif; font-size: 12px;
      color: var(--tally-green); opacity: 0.7; margin-bottom: 14px;
    }
    .ob-steps { display: flex; flex-direction: column; gap: 10px; }
    .ob-step {
      display: flex; gap: 12px; align-items: flex-start;
      padding: 10px 12px; background: rgba(255,255,255,0.5);
      border-radius: 10px; border: 1px solid rgba(26,122,74,0.12);
      transition: background 0.2s, opacity 0.2s;
    }
    .ob-step.done { background: rgba(255,255,255,0.85); opacity: 0.7; }
    .ob-check {
      width: 24px; height: 24px; border-radius: 50%;
      background: var(--tally-green); color: white;
      font-family: 'Geist Mono', monospace; font-size: 11px; font-weight: 600;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .ob-step-title {
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 600; color: var(--text);
    }
    .ob-step-sub {
      font-family: 'Geist', sans-serif; font-size: 11px; color: var(--text3); margin-top: 1px;
    }
    .ob-action {
      margin-top: 14px; width: 100%;
      background: var(--tally-green); color: white; border: none; border-radius: 10px;
      font-family: 'Geist', sans-serif; font-size: 13px; font-weight: 500;
      padding: 10px; cursor: pointer; transition: opacity 0.15s;
    }
    .ob-action:hover { opacity: 0.85; }
  `],
})
export class OnboardingComponent {
  private wallet = inject(WalletService);
  private expiry = inject(ExpiryService);

  dismissed = signal(!!this.safeLocalStorageGet(ONBOARDED_KEY));

  step1 = computed(() => this.wallet.hasAnyPoints());
  step2 = computed(() => Object.keys(this.expiry.records()).length > 0);
  step3 = computed(() => !!this.safeLocalStorageGet(OPTIMIZER_KEY));

  allDone = computed(() => this.step1() && this.step2() && this.step3());

  dismiss(): void {
    this.safeLocalStorageSet(ONBOARDED_KEY, '1');
    this.dismissed.set(true);
  }

  private safeLocalStorageGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeLocalStorageSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
}

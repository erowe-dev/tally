import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'tally-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="logo-wrap" [class.small]="size === 'sm'">
      <div class="logo-icon">
        <svg [attr.width]="size === 'sm' ? 18 : 24" [attr.height]="size === 'sm' ? 18 : 24"
             viewBox="0 0 26 26" fill="none">
          <line x1="5" y1="6" x2="5" y2="20" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="10" y1="6" x2="10" y2="20" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="15" y1="6" x2="15" y2="20" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="20" y1="6" x2="20" y2="20" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
          <line x1="3" y1="18" x2="22" y2="8" stroke="white" stroke-width="2.2" stroke-linecap="round"/>
        </svg>
      </div>
      <span class="logo-wordmark" *ngIf="showText">Tally</span>
    </div>
  `,
  styles: [`
    .logo-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-icon {
      background: var(--tally-green);
      border-radius: 10px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .logo-wrap.small .logo-icon {
      width: 30px;
      height: 30px;
      border-radius: 7px;
    }
    .logo-wordmark {
      font-family: 'Instrument Serif', Georgia, serif;
      font-size: 26px;
      font-weight: 400;
      color: var(--text);
      letter-spacing: -0.01em;
    }
    .logo-wrap.small .logo-wordmark {
      font-size: 20px;
    }
  `]
})
export class TallyLogoComponent {
  @Input() size: 'sm' | 'md' = 'md';
  @Input() showText = true;
}

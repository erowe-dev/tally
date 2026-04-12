import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../core/services/data.service';
import { CreditCard } from '../../core/models';

@Component({
  selector: 'tally-cards',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-content">
      <div class="section-eyebrow">Programs & Partners</div>
      <h2 class="section-title">Transfer <em>partners</em><br>at a glance</h2>

      <div class="cards-list">
        <div class="cc-card" *ngFor="let card of data.cards">
          <div class="cc-header">
            <div class="cc-badge" [style.background]="card.color">{{ card.icon }}</div>
            <div class="cc-meta">
              <div class="cc-name">{{ card.name }}</div>
              <div class="cc-cards">{{ card.cards.join(' · ') }}</div>
            </div>
            <div class="cc-best">
              <div class="cc-best-val">{{ getBestCpp(card) }}¢</div>
              <div class="cc-best-label">best cpp</div>
            </div>
          </div>
          <div class="partners">
            <div class="partner-row" *ngFor="let p of card.partners">
              <span class="p-icon">{{ p.icon }}</span>
              <span class="p-name">{{ p.name }}</span>
              <span class="p-ratio" [class.great]="p.quality === 'great'" [class.good]="p.quality === 'good'">
                {{ p.ratio }} · ~{{ p.cpp }}¢
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cards-list { display: flex; flex-direction: column; gap: 14px; }

    .cc-card { background: var(--white); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; }

    .cc-header {
      padding: 16px 18px; display: flex; align-items: center; gap: 14px;
      border-bottom: 1px solid var(--border);
    }
    .cc-badge {
      width: 46px; height: 30px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; flex-shrink: 0;
    }
    .cc-meta { flex: 1; min-width: 0; }
    .cc-name { font-size: 14px; font-weight: 600; color: var(--text); }
    .cc-cards {
      font-size: 10px; color: var(--text3);
      font-family: 'Geist Mono', monospace; letter-spacing: 0.04em;
      margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .cc-best { text-align: right; flex-shrink: 0; }
    .cc-best-val { font-family: 'Geist Mono', monospace; font-size: 16px; color: var(--tally-green); }
    .cc-best-label {
      font-family: 'Geist Mono', monospace; font-size: 9px;
      color: var(--text3); letter-spacing: 0.1em; text-transform: uppercase;
    }

    .partners { padding: 12px 18px; display: flex; flex-direction: column; gap: 8px; }
    .partner-row { display: flex; align-items: center; gap: 10px; }
    .p-icon { font-size: 15px; width: 22px; text-align: center; flex-shrink: 0; }
    .p-name { flex: 1; font-size: 12px; color: var(--text); font-weight: 500; }
    .p-ratio { font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--text3); white-space: nowrap; }
    .p-ratio.great { color: var(--tally-green); }
    .p-ratio.good  { color: var(--tally-amber); }
  `]
})
export class CardsComponent {
  data = inject(DataService);

  getBestCpp(card: CreditCard): number {
    return Math.max(...card.partners.map(p => p.cpp));
  }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'tally-sweetspots',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-content">
      <div class="section-eyebrow">Known Sweet Spots</div>
      <h2 class="section-title"><em>Hidden</em> value<br>redemptions</h2>

      <div class="spots-list">
        <div class="spot-card" *ngFor="let s of data.sweetSpots">
          <div class="spot-route" [innerHTML]="formatRoute(s.route)"></div>
          <div class="spot-detail">{{ s.detail.toUpperCase() }}</div>
          <div class="spot-stats">
            <div class="stat">
              <span class="stat-val">{{ s.ptsNeeded }}</span>
              <span class="stat-label">Points</span>
            </div>
            <div class="stat">
              <span class="stat-val">{{ s.estCash }}</span>
              <span class="stat-label">Cash Value</span>
            </div>
            <div class="stat">
              <span class="stat-val cpp">{{ s.cpp }}</span>
              <span class="stat-label">Est. CPP</span>
            </div>
          </div>
          <p class="spot-note">{{ s.note }}</p>
          <div class="spot-chips">
            <span class="chip card-chip" *ngFor="let c of s.cards">{{ c }}</span>
            <span class="chip prog-chip" *ngFor="let p of s.programs">{{ p }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .spots-list { display: flex; flex-direction: column; gap: 12px; }

    .spot-card {
      background: var(--white); border: 1px solid var(--border);
      border-radius: 14px; padding: 18px;
      position: relative; overflow: hidden;
    }
    .spot-card::before {
      content: ''; position: absolute;
      top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, transparent, var(--tally-green), transparent);
    }

    .spot-route {
      font-family: 'Instrument Serif', serif;
      font-size: 20px; font-weight: 400; color: var(--text); margin-bottom: 4px;
    }
    :host ::ng-deep .spot-route .arrow { color: var(--tally-green); font-style: italic; }

    .spot-detail {
      font-family: 'Geist Mono', monospace;
      font-size: 9px; letter-spacing: 0.1em; color: var(--text3); margin-bottom: 14px;
    }
    .spot-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
    .stat {
      background: var(--surface); border-radius: 10px; padding: 10px;
      text-align: center; display: flex; flex-direction: column; gap: 2px;
    }
    .stat-val {
      font-family: 'Geist Mono', monospace; font-size: 14px; color: var(--tally-green);
    }
    .stat-val.cpp { color: var(--tally-green-mid); }
    .stat-label {
      font-family: 'Geist Mono', monospace; font-size: 8px;
      color: var(--text3); letter-spacing: 0.1em; text-transform: uppercase;
    }
    .spot-note { font-size: 12px; color: var(--text2); line-height: 1.55; margin-bottom: 12px; }

    .spot-chips { display: flex; gap: 5px; flex-wrap: wrap; }
    .chip {
      border-radius: 6px; padding: 3px 8px;
      font-family: 'Geist Mono', monospace; font-size: 9px; letter-spacing: 0.05em;
    }
    .card-chip { background: var(--surface); border: 1px solid var(--border); color: var(--text2); }
    .prog-chip { background: var(--tally-green-light); border: 1px solid rgba(26,122,74,0.2); color: var(--tally-green); }
  `]
})
export class SweetspotsComponent {
  data = inject(DataService);

  formatRoute(route: string): string {
    return route.replace('→', '<span class="arrow"> → </span>');
  }
}

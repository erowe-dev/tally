import { Injectable, signal } from '@angular/core';
import { NavTab } from '../models';
import { CabinClass } from '../models';

export interface OptimizerPrefill {
  fromCity?: string;
  toCity?: string;
  cabin?: CabinClass;
}

export interface NavigationRequest {
  tab: NavTab;
  optimizerPrefill?: OptimizerPrefill;
}

/**
 * Lightweight cross-component navigation bus.
 * A component sets `pending()` to request a tab switch (optionally with
 * pre-fill data). AppComponent watches it, switches tabs, then clears it.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  readonly pending = signal<NavigationRequest | null>(null);

  navigateTo(req: NavigationRequest): void {
    this.pending.set(req);
  }

  clear(): void {
    this.pending.set(null);
  }
}

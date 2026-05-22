import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, isDevMode } from '@angular/core';
import { environment } from '../../../environments/environment';

type JsonPrimitive = string | number | boolean | null;
type AnalyticsProps = Record<string, JsonPrimitive>;

type AnalyticsEventMap = {
  tab_viewed: { tab: string };
  optimizer_search: { trip_type: string; route_category: string; result_count: number };
  sweet_spot_favorited: { spot_key: string; cpp_tier: string; saved: boolean };
  balance_updated: { card_id: string; non_zero: boolean };
  transfer_calculated: { source_card: string; partner: string; points_required: number };
  sweet_spots_deep_linked: { from: string; filter: string };
};

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly browserWindow = isPlatformBrowser(this.platformId) ? this.document.defaultView : null;

  track<Name extends keyof AnalyticsEventMap>(event: Name, props: AnalyticsEventMap[Name]): void {
    const analytics = environment.analytics;
    if (!analytics.enabled) return;

    const payload = {
      event,
      properties: this.cleanProps(props),
      timestamp: new Date().toISOString(),
    };

    if (!analytics.endpoint) {
      if (isDevMode()) console.debug('[analytics]', payload);
      return;
    }

    const body = JSON.stringify(payload);
    const navigatorRef = this.browserWindow?.navigator;
    if (navigatorRef?.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigatorRef.sendBeacon(analytics.endpoint, blob)) return;
    }

    this.browserWindow?.fetch(analytics.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Analytics must never affect product flows.
    });
  }

  private cleanProps(props: AnalyticsProps): AnalyticsProps {
    return Object.fromEntries(
      Object.entries(props).filter(([, value]) => value !== null && value !== undefined),
    );
  }
}

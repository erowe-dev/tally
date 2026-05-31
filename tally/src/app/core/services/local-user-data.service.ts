import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

const USER_DATA_KEYS = [
  'tally_cache_balances',
  'tally_cache_expiry',
  'tally_expiry_pending_v1',
  'tally_expiry_v1',
  'tally_home_airport_v1',
  'tally_preferences_v1',
  'tally_route_history_v1',
  'tally_route_templates_v1',
  'tally_searches_deleted_v1',
  'tally_searches_pending_v1',
  'tally_searches_v1',
  'tally_sweetspot_favs_v1',
  'tally_trips_v1',
  'tally_wallet_goal_v1',
  'tally_wallet_history_v1',
  'tally_wallet_pending_v1',
  'tally_wallet_v1',
] as const;

@Injectable({ providedIn: 'root' })
export class LocalUserDataService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly browserWindow = isPlatformBrowser(this.platformId) ? this.document.defaultView : null;

  clearUserData(): void {
    const storage = this.browserWindow?.localStorage;
    if (!storage) return;

    for (const key of USER_DATA_KEYS) {
      try {
        storage.removeItem(key);
      } catch {
        // Best-effort cleanup. Logout should continue even if storage is blocked.
      }
    }
  }
}

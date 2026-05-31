import { TestBed } from '@angular/core/testing';
import { LocalUserDataService } from './local-user-data.service';

describe('LocalUserDataService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('clears user-owned caches while preserving device UI state', () => {
    const userOwnedKeys = [
      'tally_cache_balances',
      'tally_cache_expiry',
      'tally_expiry_pending_v1',
      'tally_expiry_v1',
      'tally_home_airport_v1',
      'tally_preferences_pending_v1',
      'tally_preferences_v1',
      'tally_recent_airports_v1',
      'tally_route_history_v1',
      'tally_route_templates_v1',
      'tally_searches_deleted_v1',
      'tally_searches_pending_v1',
      'tally_searches_v1',
      'tally_sweetspot_favs_v1',
      'tally_trips_deleted_v1',
      'tally_trips_pending_v1',
      'tally_trips_v1',
      'tally_wallet_goal_v1',
      'tally_wallet_history_v1',
      'tally_wallet_pending_v1',
      'tally_wallet_v1',
    ];
    for (const key of userOwnedKeys) {
      localStorage.setItem(key, 'user data');
    }
    localStorage.setItem('tally_active_tab_v1', 'wallet');
    localStorage.setItem('tally_install_dismissed_v1', '1');
    localStorage.setItem('tally_cards_ui_v1', '{"filter":"all"}');
    localStorage.setItem('tally_sweetspots_ui_v1', '{"activeFilter":"hotel"}');

    TestBed.inject(LocalUserDataService).clearUserData();

    for (const key of userOwnedKeys) {
      expect(localStorage.getItem(key)).withContext(key).toBeNull();
    }
    expect(localStorage.getItem('tally_active_tab_v1')).toBe('wallet');
    expect(localStorage.getItem('tally_install_dismissed_v1')).toBe('1');
    expect(localStorage.getItem('tally_cards_ui_v1')).toBe('{"filter":"all"}');
    expect(localStorage.getItem('tally_sweetspots_ui_v1')).toBe('{"activeFilter":"hotel"}');
  });
});

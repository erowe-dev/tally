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
    localStorage.setItem('tally_wallet_v1', '{"amex_mr":1000}');
    localStorage.setItem('tally_preferences_v1', '{"heldProgramIds":["hyatt"]}');
    localStorage.setItem('tally_cache_balances', '{"savedAt":1,"data":{}}');
    localStorage.setItem('tally_active_tab_v1', 'wallet');
    localStorage.setItem('tally_install_dismissed_v1', '1');

    TestBed.inject(LocalUserDataService).clearUserData();

    expect(localStorage.getItem('tally_wallet_v1')).toBeNull();
    expect(localStorage.getItem('tally_preferences_v1')).toBeNull();
    expect(localStorage.getItem('tally_cache_balances')).toBeNull();
    expect(localStorage.getItem('tally_active_tab_v1')).toBe('wallet');
    expect(localStorage.getItem('tally_install_dismissed_v1')).toBe('1');
  });
});

import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  const originalAnalytics = { ...environment.analytics };
  let sendBeaconSpy: jasmine.Spy;
  let fetchSpy: jasmine.Spy;

  beforeEach(() => {
    environment.analytics.enabled = true;
    environment.analytics.endpoint = 'https://example.test/analytics';

    sendBeaconSpy = spyOn(navigator, 'sendBeacon').and.returnValue(true);
    fetchSpy = spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(null, { status: 204 })));

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    environment.analytics.enabled = originalAnalytics.enabled;
    environment.analytics.endpoint = originalAnalytics.endpoint;
    TestBed.resetTestingModule();
  });

  it('sends analytics with sendBeacon when available', () => {
    const service = TestBed.inject(AnalyticsService);

    service.track('tab_viewed', { tab: 'wallet' });

    expect(sendBeaconSpy).toHaveBeenCalledOnceWith(
      'https://example.test/analytics',
      jasmine.any(Blob),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon declines the payload', () => {
    sendBeaconSpy.and.returnValue(false);
    const service = TestBed.inject(AnalyticsService);

    service.track('balance_updated', { card_id: 'amex_mr', non_zero: true });

    expect(fetchSpy).toHaveBeenCalledOnceWith(
      'https://example.test/analytics',
      jasmine.objectContaining({
        method: 'POST',
        keepalive: true,
      }),
    );
  });

  it('does not send analytics when disabled', () => {
    environment.analytics.enabled = false;
    const service = TestBed.inject(AnalyticsService);

    service.track('tab_viewed', { tab: 'cards' });

    expect(sendBeaconSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ErrorReporterService } from './error-reporter.service';

describe('ErrorReporterService', () => {
  const originalReporting = { ...environment.errorReporting };
  let fetchSpy: jasmine.Spy;
  let originalPath: string;

  beforeEach(() => {
    environment.errorReporting.enabled = true;
    environment.errorReporting.endpoint = 'https://example.test/errors';
    originalPath = `${location.pathname}${location.search}${location.hash}`;
    history.pushState(null, '', '/error-smoke?code=secret#token');

    fetchSpy = spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(null, { status: 204 })));

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    history.pushState(null, '', originalPath);
    environment.errorReporting.enabled = originalReporting.enabled;
    environment.errorReporting.endpoint = originalReporting.endpoint;
    TestBed.resetTestingModule();
  });

  it('sends a privacy-safe error payload', () => {
    const service = TestBed.inject(ErrorReporterService);

    service.report(new Error('boom'), 'angular_unhandled');

    expect(fetchSpy).toHaveBeenCalledOnceWith(
      'https://example.test/errors',
      jasmine.objectContaining({
        method: 'POST',
        keepalive: true,
      }),
    );

    const [, init] = fetchSpy.calls.mostRecent().args;
    const payload = JSON.parse(String((init as RequestInit).body));
    expect(payload.message).toBe('boom');
    expect(payload.context).toBe('angular_unhandled');
    expect(payload.url).toBe(`${location.origin}/error-smoke`);
    expect(payload.url).not.toContain('secret');
    expect(payload.url).not.toContain('token');
  });

  it('does not send reports when disabled', () => {
    environment.errorReporting.enabled = false;
    spyOn(console, 'error');
    const service = TestBed.inject(ErrorReporterService);

    service.report(new Error('ignored'), 'manual');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports browser error events once listeners are started', () => {
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    spyOn(window, 'addEventListener').and.callFake((
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      listeners.set(type, listener);
    });
    const service = TestBed.inject(ErrorReporterService);

    service.startBrowserListeners();
    service.startBrowserListeners();
    const listener = listeners.get('error') as EventListener;
    listener(new ErrorEvent('error', { message: 'window boom', error: new Error('window boom') }));

    expect(window.addEventListener).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledOnceWith(
      'https://example.test/errors',
      jasmine.objectContaining({ method: 'POST', keepalive: true }),
    );

    const [, init] = fetchSpy.calls.mostRecent().args;
    const payload = JSON.parse(String((init as RequestInit).body));
    expect(payload.message).toBe('window boom');
    expect(payload.context).toBe('browser_error');
  });

  it('reports unhandled rejection events', () => {
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    spyOn(window, 'addEventListener').and.callFake((
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      listeners.set(type, listener);
    });
    const service = TestBed.inject(ErrorReporterService);

    service.startBrowserListeners();
    const listener = listeners.get('unhandledrejection') as EventListener;
    listener(new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: new Error('rejected'),
    }));

    const [, init] = fetchSpy.calls.mostRecent().args;
    const payload = JSON.parse(String((init as RequestInit).body));
    expect(payload.message).toBe('rejected');
    expect(payload.context).toBe('unhandled_rejection');
  });
});

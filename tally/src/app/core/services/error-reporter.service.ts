import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ErrorHandler, Injectable, PLATFORM_ID, inject, isDevMode } from '@angular/core';
import { environment } from '../../../environments/environment';

interface ErrorPayload {
  message: string;
  stack?: string;
  context: string;
  url?: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ErrorReporterService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly browserWindow = isPlatformBrowser(this.platformId) ? this.document.defaultView : null;
  private browserListenersStarted = false;

  startBrowserListeners(): void {
    if (!this.browserWindow || this.browserListenersStarted) return;
    this.browserListenersStarted = true;

    this.browserWindow.addEventListener('error', (event) => {
      const error = event.error instanceof Error
        ? event.error
        : new Error(event.message || 'Unhandled browser error');
      this.report(error, 'browser_error');
    });

    this.browserWindow.addEventListener('unhandledrejection', (event) => {
      this.report(event.reason ?? 'Unhandled promise rejection', 'unhandled_rejection');
    });
  }

  report(error: unknown, context: string): void {
    const payload = this.toPayload(error, context);
    const reporting = environment.errorReporting;

    if (!reporting.enabled || !reporting.endpoint) {
      if (isDevMode()) console.error('[error-report]', payload);
      return;
    }

    this.browserWindow?.fetch(reporting.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Error reporting must never create a secondary user-visible failure.
    });
  }

  private toPayload(error: unknown, context: string): ErrorPayload {
    const err = error instanceof Error ? error : new Error(String(error));
    return {
      message: err.message.slice(0, 500),
      stack: err.stack?.slice(0, 2000),
      context,
      url: this.safeUrl(),
      timestamp: new Date().toISOString(),
    };
  }

  private safeUrl(): string | undefined {
    const location = this.browserWindow?.location;
    if (!location) return undefined;
    return `${location.origin}${location.pathname}`;
  }
}

@Injectable()
export class TallyErrorHandler implements ErrorHandler {
  private readonly reporter = inject(ErrorReporterService);

  handleError(error: unknown): void {
    this.reporter.report(error, 'angular_unhandled');
    console.error(error);
  }
}

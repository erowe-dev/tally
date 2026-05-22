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
      url: this.browserWindow?.location.href,
      timestamp: new Date().toISOString(),
    };
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

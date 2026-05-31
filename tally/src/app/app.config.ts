import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { provideAuth0 } from '@auth0/auth0-angular';
import { routes } from './app.routes';
import { TallyErrorHandler } from './core/services/error-reporter.service';
import { environment } from '../environments/environment';

const authRedirectUri =
  typeof window === 'undefined'
    ? environment.auth0.authorizationParams.redirect_uri
    : window.location.origin;

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    { provide: ErrorHandler, useClass: TallyErrorHandler },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAuth0({
      domain: environment.auth0.domain,
      clientId: environment.auth0.clientId,
      authorizationParams: {
        ...environment.auth0.authorizationParams,
        redirect_uri: authRedirectUri,
      },
      // localstorage survives page refresh; memory (default) logs user out on refresh
      cacheLocation: 'localstorage',
      // Refresh tokens avoid silent iframe auth — required for iOS Safari
      useRefreshTokens: true,
    }),
  ],
};

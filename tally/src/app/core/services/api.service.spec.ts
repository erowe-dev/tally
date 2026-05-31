import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { of, throwError } from 'rxjs';
import { ApiService } from './api.service';

describe('ApiService cache validation', () => {
  let auth0: jasmine.SpyObj<Auth0Service>;
  let http: jasmine.SpyObj<HttpClient>;

  beforeEach(() => {
    localStorage.clear();
    auth0 = jasmine.createSpyObj<Auth0Service>('Auth0Service', ['getAccessTokenSilently']);
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get']);
    auth0.getAccessTokenSilently.and.returnValue(of('token'));

    TestBed.configureTestingModule({
      providers: [
        ApiService,
        { provide: Auth0Service, useValue: auth0 },
        { provide: HttpClient, useValue: http },
      ],
    });
  });

  it('rejects malformed balance cache fallback data', done => {
    localStorage.setItem('tally_cache_balances', JSON.stringify({
      savedAt: Date.now(),
      data: { amex_mr: 1000, unknown_program: 5000 },
    }));
    http.get.and.returnValue(throwError(() => new Error('network')));

    TestBed.inject(ApiService).getBalancesWithCache().subscribe({
      next: () => done.fail('expected malformed cache to be rejected'),
      error: error => {
        expect(error).toEqual(jasmine.any(Error));
        done();
      },
    });
  });

  it('returns valid expiry cache fallback data', done => {
    localStorage.setItem('tally_cache_expiry', JSON.stringify({
      savedAt: Date.now(),
      data: { citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' } },
    }));
    http.get.and.returnValue(throwError(() => new Error('network')));

    TestBed.inject(ApiService).getExpiryRecordsWithCache().subscribe({
      next: records => {
        expect(records).toEqual({ citi_ty: { cardId: 'citi_ty', lastActivityDate: '2026-05-18' } });
        done();
      },
      error: error => done.fail(error),
    });
  });

  it('rejects malformed expiry cache fallback data', done => {
    localStorage.setItem('tally_cache_expiry', JSON.stringify({
      savedAt: Date.now(),
      data: {
        citi_ty: { cardId: 'hyatt', lastActivityDate: '2026-05-18' },
        hyatt: { cardId: 'hyatt', lastActivityDate: '2999-01-01' },
      },
    }));
    http.get.and.returnValue(throwError(() => new Error('network')));

    TestBed.inject(ApiService).getExpiryRecordsWithCache().subscribe({
      next: () => done.fail('expected malformed cache to be rejected'),
      error: error => {
        expect(error).toEqual(jasmine.any(Error));
        done();
      },
    });
  });
});

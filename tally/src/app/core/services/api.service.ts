import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SavedTrip } from '../models';

export interface ApiExpiryRecord {
  cardId: string;
  lastActivityDate: string;
}

/**
 * Centralises all authenticated HTTP calls to the Tally Express API.
 * Every method attaches the Auth0 access token automatically via withAuth().
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private auth0 = inject(Auth0Service);

  // Wraps any HTTP call with a fresh Auth0 access token
  private withAuth<T>(call: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    return this.auth0.getAccessTokenSilently().pipe(
      switchMap(token =>
        call(new HttpHeaders({ Authorization: `Bearer ${token}` })),
      ),
    );
  }

  // ── Balances ────────────────────────────────────────────────────────────────

  getBalances(): Observable<Record<string, number>> {
    return this.withAuth(headers =>
      this.http.get<Record<string, number>>(
        `${environment.apiUrl}/api/balances`,
        { headers },
      ),
    );
  }

  setBalance(cardId: string, amount: number): Observable<unknown> {
    return this.withAuth(headers =>
      this.http.put(
        `${environment.apiUrl}/api/balances/${cardId}`,
        { amount },
        { headers },
      ),
    );
  }

  // ── Expiry records ──────────────────────────────────────────────────────────

  getExpiryRecords(): Observable<Record<string, ApiExpiryRecord>> {
    return this.withAuth(headers =>
      this.http.get<Record<string, ApiExpiryRecord>>(
        `${environment.apiUrl}/api/expiry`,
        { headers },
      ),
    );
  }

  setExpiryRecord(cardId: string, lastActivityDate: string): Observable<unknown> {
    return this.withAuth(headers =>
      this.http.put(
        `${environment.apiUrl}/api/expiry/${cardId}`,
        { lastActivityDate },
        { headers },
      ),
    );
  }

  deleteExpiryRecord(cardId: string): Observable<unknown> {
    return this.withAuth(headers =>
      this.http.delete(
        `${environment.apiUrl}/api/expiry/${cardId}`,
        { headers },
      ),
    );
  }

  // ── Trips ───────────────────────────────────────────────────────────────────

  getTrips(): Observable<SavedTrip[]> {
    return this.withAuth(headers =>
      this.http.get<SavedTrip[]>(`${environment.apiUrl}/api/trips`, { headers }),
    );
  }

  createTrip(trip: Omit<SavedTrip, 'id' | 'createdAt'>): Observable<SavedTrip> {
    return this.withAuth(headers =>
      this.http.post<SavedTrip>(`${environment.apiUrl}/api/trips`, trip, { headers }),
    );
  }

  deleteTrip(id: string): Observable<unknown> {
    return this.withAuth(headers =>
      this.http.delete(`${environment.apiUrl}/api/trips/${id}`, { headers }),
    );
  }
}

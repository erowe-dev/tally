import { Injectable, inject } from '@angular/core';
import { DataService } from './data.service';
import { Recommendation, CabinClass, HotelCategory } from '../models';

const US_AIRPORTS = new Set(['ORD','LAX','JFK','SFO','MIA','DFW','SEA','ATL','BOS','DEN',
  'LAS','MCO','MSP','DTW','PHL','CLT','IAH','EWR','IAD','DCA','MDW','AUS','PHX','SAN','TPA','PDX','SLC','BWI']);
const EU_AIRPORTS = new Set(['LHR','CDG','AMS','FRA','MAD','FCO','ZRH','MUC','IST','DUB',
  'CPH','VIE','ARN','HEL','BCN','LIS','BRU','ATH','PRG','WAW']);
const ASIA_AIRPORTS = new Set(['NRT','HND','ICN','PEK','PVG','HKG','SIN','BKK','KUL',
  'CGK','DEL','BOM','SYD','MEL','NAN','AKL']);

const CABIN_MULT: Record<CabinClass, number> = {
  economy: 0.5, premium: 0.75, business: 1.0, first: 1.6
};

@Injectable({ providedIn: 'root' })
export class OptimizerService {
  private data = inject(DataService);

  getFlightRecs(from: string, to: string, cabin: CabinClass, passengers: number): Recommendation[] {
    const category = this.detectRoute(from.toUpperCase(), to.toUpperCase());
    const base = this.data.flightRecs[category] ?? this.data.flightRecs['default'];
    const mult = CABIN_MULT[cabin] ?? 1.0;

    return base
      .map(r => ({
        ...r,
        ptsRequired: Math.round(r.ptsBase * mult * passengers / 1000) * 1000
      }))
      .sort((a, b) => b.cpp - a.cpp);
  }

  getHotelRecs(category: HotelCategory, nights: number): Recommendation[] {
    const base = this.data.hotelRecs[category] ?? this.data.hotelRecs['default'];
    return base
      .map(r => ({ ...r, ptsRequired: r.ptsBase * nights }))
      .sort((a, b) => b.cpp - a.cpp);
  }

  private detectRoute(from: string, to: string): string {
    const fromUS = US_AIRPORTS.has(from);
    const fromEU = EU_AIRPORTS.has(from);
    const fromAsia = ASIA_AIRPORTS.has(from);
    const toEU   = EU_AIRPORTS.has(to);
    const toAsia = ASIA_AIRPORTS.has(to);
    const toUS   = US_AIRPORTS.has(to);

    if ((fromUS && toEU) || (fromEU && toUS)) return 'transatlantic';
    if ((fromUS && toAsia) || (fromAsia && toUS)) return 'transpacific';
    if (fromUS && toUS)   return 'domestic';
    return 'default';
  }
}

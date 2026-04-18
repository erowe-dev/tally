import { Injectable, inject } from '@angular/core';
import { DataService } from './data.service';
import { Recommendation, CabinClass, HotelCategory } from '../models';

const US_AIRPORTS = new Set([
  'ORD','LAX','JFK','SFO','MIA','DFW','SEA','ATL','BOS','DEN',
  'LAS','MCO','MSP','DTW','PHL','CLT','IAH','EWR','IAD','DCA',
  'MDW','AUS','PHX','SAN','TPA','PDX','SLC','BWI','RDU','OAK',
  'FLL','HOU','ABQ','RSW','PBI','SAT','SMF','SNA','ONT','LGB',
]);
const EU_AIRPORTS = new Set([
  'LHR','CDG','AMS','FRA','MAD','FCO','ZRH','MUC','IST','DUB',
  'CPH','VIE','ARN','HEL','BCN','LIS','BRU','ATH','PRG','WAW',
  'MXP','FCO','NCE','GVA','OSL','KEF','TXL','BER','HAM','DUS',
  'STN','LGW','LTN','MAN','EDI','GLA',
]);
const ASIA_AIRPORTS = new Set([
  'NRT','HND','ICN','PEK','PVG','HKG','SIN','BKK','KUL',
  'CGK','DEL','BOM','SYD','MEL','NAN','AKL','MNL','SGN','HAN',
  'KIX','NGO','CTS','TPE','TAO','CTU','XIY','KMG',
]);
const LATAM_AIRPORTS = new Set([
  'GRU','GIG','BOG','LIM','SCL','EZE','CCS','MEX','CUN','SJO',
  'PTY','UIO','ASU','MVD','MDE','VVI','HAV',
]);
const CARIBBEAN_AIRPORTS = new Set([
  'SJU','STT','STX','NAS','BGI','MBJ','KIN','POS','GEO','ANU',
  'SKB','SXM','EIS','UVF','GND','PTP','FDF','SFG','TAB',
]);
const MIDEAST_AIRPORTS = new Set([
  'DXB','AUH','DOH','RUH','AMM','BEY','TLV','CAI','KWI','BAH','MCT','ADE',
]);
const AFRICA_AIRPORTS = new Set([
  'JNB','CPT','NBO','LOS','ACC','CMN','ALG','TUN','ADD','DAR',
  'RAK','MRU','SEZ','HRE','LUN',
]);

const CABIN_MULT: Record<CabinClass, number> = {
  economy: 0.5, premium: 0.75, business: 1.0, first: 1.6
};

@Injectable({ providedIn: 'root' })
export class OptimizerService {
  private data = inject(DataService);

  getFlightRecs(from: string, to: string, cabin: CabinClass, passengers: number): { recs: Recommendation[]; category: string } {
    const category = this.detectRoute(from.toUpperCase(), to.toUpperCase());
    const base = this.data.flightRecs[category] ?? this.data.flightRecs['default'];
    const mult = CABIN_MULT[cabin] ?? 1.0;

    const recs = base
      .map(r => ({
        ...r,
        ptsRequired: Math.round(r.ptsBase * mult * passengers / 1000) * 1000,
      }))
      .sort((a, b) => b.cpp - a.cpp);

    return { recs, category };
  }

  getHotelRecs(category: HotelCategory, nights: number): Recommendation[] {
    const base = this.data.hotelRecs[category] ?? this.data.hotelRecs['default'];
    return base
      .map(r => ({ ...r, ptsRequired: r.ptsBase * nights }))
      .sort((a, b) => b.cpp - a.cpp);
  }

  private detectRoute(from: string, to: string): string {
    const fromUS  = US_AIRPORTS.has(from);
    const fromEU  = EU_AIRPORTS.has(from);
    const fromAsia = ASIA_AIRPORTS.has(from);
    const toEU    = EU_AIRPORTS.has(to);
    const toAsia  = ASIA_AIRPORTS.has(to);
    const toUS    = US_AIRPORTS.has(to);
    const toLatam = LATAM_AIRPORTS.has(to);
    const fromLatam = LATAM_AIRPORTS.has(from);
    const toCarib = CARIBBEAN_AIRPORTS.has(to);
    const fromCarib = CARIBBEAN_AIRPORTS.has(from);
    const toMid   = MIDEAST_AIRPORTS.has(to);
    const fromMid = MIDEAST_AIRPORTS.has(from);
    const toAfric = AFRICA_AIRPORTS.has(to);
    const fromAfric = AFRICA_AIRPORTS.has(from);

    if ((fromUS && toEU) || (fromEU && toUS))           return 'transatlantic';
    if ((fromUS && toAsia) || (fromAsia && toUS))        return 'transpacific';
    if (fromUS && toUS)                                  return 'domestic';
    if ((fromUS && toLatam) || (fromLatam && toUS))      return 'latin_america';
    if ((fromUS && toCarib) || (fromCarib && toUS))      return 'caribbean';
    if ((fromUS && toMid) || (fromMid && toUS))          return 'middle_east';
    if ((fromUS && toAfric) || (fromAfric && toUS))      return 'africa';
    if ((fromEU && toAsia) || (fromAsia && toEU))        return 'eurasia';
    return 'default';
  }
}

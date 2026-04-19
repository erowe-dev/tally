import { Injectable, inject } from '@angular/core';
import { DataService } from './data.service';
import { Recommendation, CabinClass, HotelCategory } from '../models';

const US_AIRPORTS = new Set([
  'ORD','LAX','JFK','SFO','MIA','DFW','SEA','ATL','BOS','DEN',
  'LAS','MCO','MSP','DTW','PHL','CLT','IAH','EWR','IAD','DCA',
  'MDW','AUS','PHX','SAN','TPA','PDX','SLC','BWI','RDU','OAK',
  'FLL','HOU','ABQ','RSW','PBI','SAT','SMF','SNA','ONT','LGB',
  'BNA','MSY','MCI','CLE','CVG','CMH','IND','PIT','BDL','MKE',
  'BUF','ALB','ROC','OMA','TUL','OKC','LIT','BHM','HSV','JAX',
]);
const EU_AIRPORTS = new Set([
  'LHR','CDG','AMS','FRA','MAD','FCO','ZRH','MUC','IST','DUB',
  'CPH','VIE','ARN','HEL','BCN','LIS','BRU','ATH','PRG','WAW',
  'MXP','NCE','GVA','OSL','KEF','BER','HAM','DUS',
  'STN','LGW','LTN','MAN','EDI','GLA',
  'BUD','OPO','AGP','VCE','NAP','BOD','LYS','TLS','SVQ','PMI',
  'SKG','OTP','SOF','ZAG','LJU','BEG','SAW','AYT',
]);
const ASIA_AIRPORTS = new Set([
  'NRT','HND','ICN','PEK','PVG','HKG','SIN','BKK','KUL',
  'CGK','DEL','BOM','SYD','MEL','NAN','AKL','MNL','SGN','HAN',
  'KIX','NGO','CTS','TPE','TAO','CTU','XIY','KMG',
  'MLE','DPS','CMB','CNX','DXR','PNH','REP','RGN','DAC','KTM',
  'CHC','WLG','OOL','BNE','PER','ADL','CBR','CEB','DVO',
]);
const LATAM_AIRPORTS = new Set([
  'GRU','GIG','BOG','LIM','SCL','EZE','CCS','MEX','CUN','SJO',
  'PTY','UIO','ASU','MVD','MDE','VVI','HAV',
  'BSB','SSA','FOR','POA','VCP','AEP','GDL','MTY','TIJ',
  'CLO','MED','ADZ','BAQ','SMR','CTG',
]);
const CARIBBEAN_AIRPORTS = new Set([
  'SJU','STT','STX','NAS','BGI','MBJ','KIN','POS','GEO','ANU',
  'SKB','SXM','EIS','UVF','GND','PTP','FDF','SFG','TAB',
  'AUA','BON','CUR','PUJ','STI','HAV','SDQ','BZE',
]);
const MIDEAST_AIRPORTS = new Set([
  'DXB','AUH','DOH','RUH','AMM','BEY','TLV','CAI','KWI','BAH','MCT','ADE',
  'MED','JED','GYD','ISU','BGW','EVN','TBS','SKD',
]);
const AFRICA_AIRPORTS = new Set([
  'JNB','CPT','NBO','LOS','ACC','CMN','ALG','TUN','ADD','DAR',
  'RAK','MRU','SEZ','HRE','LUN',
  'ABV','KAN','PHC','ROB','ABJ','DKR','FNA','OUA','CKY',
  'MPM','LAD','DLA','NSI','MBA','ZNZ',
]);
const HAWAII_AIRPORTS = new Set([
  'HNL','OGG','KOA','LIH','ITO','MKK','LNY',
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

  /**
   * Returns a deduplicated list of all flight + hotel recommendations at
   * base scale (1 passenger, 1 night, business for flights) — used to
   * power the "What can I book now?" quick-wins view.
   */
  getAllRecs(): (Recommendation & { tripType: 'flight' | 'hotel' })[] {
    const seen = new Set<string>();
    const out: (Recommendation & { tripType: 'flight' | 'hotel' })[] = [];

    // One representative entry per program per route category (business, 1 pax)
    for (const recs of Object.values(this.data.flightRecs)) {
      for (const r of recs) {
        const key = `flight|${r.program}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ ...r, ptsRequired: r.ptsBase, tripType: 'flight' });
        }
      }
    }
    // Mid-tier hotel, 3 nights
    for (const recs of Object.values(this.data.hotelRecs)) {
      for (const r of recs) {
        const key = `hotel|${r.program}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ ...r, ptsRequired: r.ptsBase * 3, tripType: 'hotel' });
        }
      }
    }

    return out.sort((a, b) => b.cpp - a.cpp);
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

    const toHawaii   = HAWAII_AIRPORTS.has(to);
    const fromHawaii = HAWAII_AIRPORTS.has(from);

    if ((fromUS && toEU) || (fromEU && toUS))             return 'transatlantic';
    if ((fromUS && toAsia) || (fromAsia && toUS))          return 'transpacific';
    if ((fromUS && toHawaii) || (fromHawaii && toUS))      return 'hawaii';
    if (fromUS && toUS)                                    return 'domestic';
    if ((fromUS && toLatam) || (fromLatam && toUS))        return 'latin_america';
    if ((fromUS && toCarib) || (fromCarib && toUS))      return 'caribbean';
    if ((fromUS && toMid) || (fromMid && toUS))          return 'middle_east';
    if ((fromUS && toAfric) || (fromAfric && toUS))      return 'africa';
    if ((fromEU && toAsia) || (fromAsia && toEU))        return 'eurasia';
    return 'default';
  }
}

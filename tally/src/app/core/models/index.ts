export interface TransferPartner {
  name: string;
  icon: string;
  ratio: string;
  type: 'airline' | 'hotel';
  quality: 'great' | 'good';
  cpp: number;
}

export interface CreditCard {
  id: string;
  name: string;
  short: string;
  icon: string;
  color: string;
  textColor: string;
  cards: string[];
  baseCpp: number;
  partners: TransferPartner[];
}

export interface Recommendation {
  program: string;
  partner: string;
  cpp: number;
  ptsBase: number;
  cards: string[];
  note: string;
  ptsRequired?: number;
}

export interface SweetSpot {
  route: string;
  detail: string;
  ptsNeeded: string;
  estCash: string;
  cpp: string;
  cards: string[];
  programs: string[];
  note: string;
}

export type TripType = 'flight' | 'hotel';
export type CabinClass = 'economy' | 'premium' | 'business' | 'first';
export type HotelCategory = 'budget' | 'mid' | 'luxury' | 'top';
export type NavTab = 'optimizer' | 'wallet' | 'cards' | 'sweetspots' | 'expiry';

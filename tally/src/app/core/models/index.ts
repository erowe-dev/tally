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
  /** Cards that earn in this program */
  cards: string[];
  baseCpp: number;
  /** 'transferable' = Amex MR / Chase UR style; 'airline' / 'hotel' = co-branded */
  category: 'transferable' | 'airline' | 'hotel';
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
  category: 'flight' | 'hotel' | 'promo';
}

export interface SavedTrip {
  id: string;
  tripType: 'flight' | 'hotel';
  origin?: string;
  destination?: string;
  cabin?: CabinClass;
  passengers?: number;
  nights?: number;
  hotelCat?: HotelCategory;
  programName: string;
  ptsRequired: number;
  notes?: string;
  createdAt: string; // ISO timestamp
}

export type TripType = 'flight' | 'hotel';
export type CabinClass = 'economy' | 'premium' | 'business' | 'first';
export type HotelCategory = 'budget' | 'mid' | 'luxury' | 'top';
export type NavTab = 'optimizer' | 'wallet' | 'cards' | 'sweetspots' | 'expiry';

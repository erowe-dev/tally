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
  /** Flag for spots added recently — shown with a ✦ New badge */
  isNew?: boolean;
}

/** A time-limited transfer bonus promotion */
export interface TransferBonus {
  from: string;     // e.g. "Amex MR"
  fromId: string;   // card id, e.g. "amex_mr"
  to: string;       // e.g. "Air France Flying Blue"
  toIcon: string;
  bonus: string;    // e.g. "30% bonus"
  expires: string;  // "YYYY-MM-DD"
  note: string;
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

export type DateFlexibility = 'exact' | 'plus_minus_3' | 'plus_minus_7' | 'month' | 'next_60_days';
export type SearchType = 'flight' | 'hotel';
export type ProviderCacheStatus = 'fresh' | 'stale' | 'miss' | 'disabled' | 'error';

export interface AirportOption {
  code: string;
  name: string;
  city: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  aliases?: string[];
}

export interface DateWindow {
  startDate: string;
  endDate: string;
  flexibility: DateFlexibility;
  tripLengthMin?: number;
  tripLengthMax?: number;
}

export interface UserPreference {
  homeAirports: string[];
  preferredCabin: CabinClass;
  maxStops: 0 | 1 | 2;
  preferredPrograms: string[];
  hotelChains: string[];
  defaultTravelers: number;
  dateFlexibility: DateFlexibility;
  pointValuationCpp: number;
  updatedAt?: string;
}

export interface HotelSearchIntent {
  destination: string;
  checkInDate?: string;
  checkOutDate?: string;
  nights?: number;
  hotelCategory?: HotelCategory;
  travelers: number;
  rooms: number;
  preferredChains: string[];
}

export interface SavedSearch {
  id: string;
  searchType: SearchType;
  originAirport?: string;
  destinationAirport?: string;
  destinationText: string;
  dateWindow: DateWindow;
  cabin?: CabinClass;
  passengers: number;
  hotelIntent?: HotelSearchIntent;
  notes?: string;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AwardAvailabilityResult {
  id: string;
  provider: string;
  source: string;
  originAirport: string;
  destinationAirport: string;
  departureDate: string;
  returnDate?: string;
  cabin: CabinClass;
  program: string;
  points: number;
  taxesUsd?: number;
  seatsAvailable?: number;
  confidence: 'low' | 'medium' | 'high';
  bookingUrl?: string;
  lastChecked: string;
  expiresAt: string;
  cacheStatus: ProviderCacheStatus;
  stale: boolean;
}

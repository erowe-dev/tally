import { Injectable } from '@angular/core';
import { CreditCard, Recommendation, SweetSpot, TransferBonus } from '../models';

@Injectable({ providedIn: 'root' })
export class DataService {

  // ── Transferable currency programs ───────────────────────────────────────
  readonly cards: CreditCard[] = [

    // ── TRANSFERABLE CURRENCIES ─────────────────────────────────────────────
    {
      id: 'amex_mr', name: 'Amex Membership Rewards', short: 'Amex MR',
      icon: '💙', color: '#006FCF', textColor: '#fff', category: 'transferable',
      cards: ['Amex Platinum', 'Amex Gold', 'Amex Green', 'Blue Business Plus'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air Canada Aeroplan',        icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'British Airways Avios',       icon: '🇬🇧', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'Air France/KLM Flying Blue',  icon: '🇫🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'Singapore KrisFlyer',         icon: '🦁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.2 },
        { name: 'ANA Mileage Club',            icon: '🎌', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.4 },
        { name: 'Virgin Atlantic Flying Club', icon: '✈', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.1 },
        { name: 'Delta SkyMiles',              icon: '△',  ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.2 },
        { name: 'Hilton Honors',               icon: '🟡', ratio: '1:2', type: 'hotel',   quality: 'good',  cpp: 0.5 },
        { name: 'Marriott Bonvoy',             icon: '🔴', ratio: '1:3', type: 'hotel',   quality: 'good',  cpp: 0.8 },
      ]
    },
    {
      id: 'chase_ur', name: 'Chase Ultimate Rewards', short: 'Chase UR',
      icon: '🔵', color: '#117ACA', textColor: '#fff', category: 'transferable',
      cards: ['Sapphire Reserve', 'Sapphire Preferred', 'Ink Business Preferred'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air Canada Aeroplan',         icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'British Airways Avios',        icon: '🇬🇧', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'United MileagePlus',           icon: '🌐', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.5 },
        { name: 'Air France/KLM Flying Blue',   icon: '🇫🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'Virgin Atlantic Flying Club',  icon: '✈', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.1 },
        { name: 'Singapore KrisFlyer',          icon: '🦁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.2 },
        { name: 'Southwest Rapid Rewards',      icon: '❤️', ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.5 },
        { name: 'World of Hyatt',               icon: '🟤', ratio: '1:1', type: 'hotel',   quality: 'great', cpp: 2.0 },
        { name: 'IHG One Rewards',              icon: '🟠', ratio: '1:1', type: 'hotel',   quality: 'good',  cpp: 0.7 },
        { name: 'Marriott Bonvoy',              icon: '🔴', ratio: '1:1', type: 'hotel',   quality: 'good',  cpp: 0.8 },
      ]
    },
    {
      id: 'citi_ty', name: 'Citi ThankYou Points', short: 'Citi TY',
      icon: '🟣', color: '#003B70', textColor: '#fff', category: 'transferable',
      cards: ['Citi Strata Premier', 'Citi Prestige', 'Citi Double Cash'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air France/KLM Flying Blue',  icon: '🇫🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'Virgin Atlantic Flying Club',  icon: '✈', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.1 },
        { name: 'Singapore KrisFlyer',          icon: '🦁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.2 },
        { name: 'Turkish Miles&Smiles',         icon: '🌙', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.3 },
        { name: 'Air Canada Aeroplan',          icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'Avianca LifeMiles',            icon: '🦅', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.6 },
        { name: 'JetBlue TrueBlue',            icon: '🔷', ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.3 },
        { name: 'Wyndham Rewards',             icon: '🔶', ratio: '1:1', type: 'hotel',   quality: 'good',  cpp: 1.0 },
      ]
    },
    {
      id: 'cap1_miles', name: 'Capital One Miles', short: 'Cap1',
      icon: '🔺', color: '#D03027', textColor: '#fff', category: 'transferable',
      cards: ['Venture X', 'Venture', 'Spark Miles'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air Canada Aeroplan',          icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'British Airways Avios',         icon: '🇬🇧', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'Air France/KLM Flying Blue',   icon: '🇫🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'Turkish Miles&Smiles',          icon: '🌙', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.3 },
        { name: 'Singapore KrisFlyer',           icon: '🦁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.2 },
        { name: 'Avianca LifeMiles',             icon: '🦅', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.6 },
        { name: 'Wyndham Rewards',              icon: '🔶', ratio: '2:3', type: 'hotel',   quality: 'good',  cpp: 1.0 },
      ]
    },
    {
      id: 'bilt', name: 'Bilt Rewards', short: 'Bilt',
      icon: '🏠', color: '#1a1a1a', textColor: '#fff', category: 'transferable',
      cards: ['Bilt Mastercard'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air Canada Aeroplan',          icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'American AAdvantage',           icon: '🦅', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'United MileagePlus',            icon: '🌐', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.5 },
        { name: 'Alaska MileagePlan',            icon: '❄️', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'Emirates Skywards',             icon: '✨', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.4 },
        { name: 'World of Hyatt',                icon: '🟤', ratio: '1:1', type: 'hotel',   quality: 'great', cpp: 2.0 },
        { name: 'IHG One Rewards',               icon: '🟠', ratio: '1:3', type: 'hotel',   quality: 'good',  cpp: 0.7 },
        { name: 'Marriott Bonvoy',               icon: '🔴', ratio: '1:3', type: 'hotel',   quality: 'good',  cpp: 0.8 },
      ]
    },

    // ── AIRLINE PROGRAMS (co-branded, earn directly) ────────────────────────
    {
      id: 'delta_skymiles', name: 'Delta SkyMiles', short: 'Delta',
      icon: '△', color: '#E01933', textColor: '#fff', category: 'airline',
      cards: ['Delta SkyMiles Gold', 'Delta SkyMiles Platinum', 'Delta SkyMiles Reserve'],
      baseCpp: 1.2,
      partners: [
        { name: 'Air France/KLM Flying Blue', icon: '🇫🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'Korean Air SkyPass',         icon: '🇰🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.6 },
        { name: 'Virgin Atlantic Flying Club',icon: '✈',  ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.1 },
        { name: 'Aeromexico Club Premier',    icon: '🌮', ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.0 },
      ]
    },
    {
      id: 'united_mp', name: 'United MileagePlus', short: 'United',
      icon: '🌐', color: '#005DAA', textColor: '#fff', category: 'airline',
      cards: ['United Explorer', 'United Quest', 'United Club Infinite'],
      baseCpp: 1.5,
      partners: [
        { name: 'Air Canada',          icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.5 },
        { name: 'Lufthansa',           icon: '🇩🇪', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.4 },
        { name: 'ANA',                 icon: '🎌', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'Singapore Airlines',  icon: '🦁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
      ]
    },
    {
      id: 'aa_aadvantage', name: 'American AAdvantage', short: 'AA Miles',
      icon: '🦅', color: '#0078D2', textColor: '#fff', category: 'airline',
      cards: ['Citi / AAdvantage Platinum Select', 'Citi / AAdvantage Executive', 'Aviator Red'],
      baseCpp: 1.7,
      partners: [
        { name: 'British Airways',         icon: '🇬🇧', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'Iberia',                  icon: '🇪🇸', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.6 },
        { name: 'Japan Airlines',          icon: '🎌', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'Cathay Pacific',          icon: '🐉', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'Finnair Plus',            icon: '🇫🇮', ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.3 },
      ]
    },
    {
      id: 'southwest_rr', name: 'Southwest Rapid Rewards', short: 'Southwest',
      icon: '❤️', color: '#304CB2', textColor: '#fff', category: 'airline',
      cards: ['Southwest Rapid Rewards Plus', 'Southwest Priority', 'Southwest Premier'],
      baseCpp: 1.5,
      partners: []
    },
    {
      id: 'alaska_mp', name: 'Alaska MileagePlan', short: 'Alaska',
      icon: '❄️', color: '#01426A', textColor: '#fff', category: 'airline',
      cards: ['Alaska Airlines Visa Signature', 'Alaska Airlines Business'],
      baseCpp: 1.8,
      partners: [
        { name: 'British Airways',  icon: '🇬🇧', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'Cathay Pacific',   icon: '🐉', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'Japan Airlines',   icon: '🎌', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'Finnair',          icon: '🇫🇮', ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.3 },
        { name: 'Condor',           icon: '🇩🇪', ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.2 },
      ]
    },

    // ── HOTEL PROGRAMS (co-branded, earn directly) ──────────────────────────
    {
      id: 'marriott_bonvoy', name: 'Marriott Bonvoy', short: 'Bonvoy',
      icon: '🔴', color: '#B2292E', textColor: '#fff', category: 'hotel',
      cards: ['Marriott Bonvoy Brilliant', 'Marriott Bonvoy Boundless', 'Marriott Bonvoy Bold'],
      baseCpp: 0.9,
      partners: [
        { name: 'United MileagePlus',  icon: '🌐', ratio: '3:1', type: 'airline', quality: 'good',  cpp: 1.1 },
        { name: 'Delta SkyMiles',      icon: '△',  ratio: '3:1', type: 'airline', quality: 'good',  cpp: 0.9 },
        { name: 'American AAdvantage', icon: '🦅', ratio: '3:1', type: 'airline', quality: 'good',  cpp: 1.1 },
        { name: 'Alaska MileagePlan',  icon: '❄️', ratio: '3:1', type: 'airline', quality: 'great', cpp: 1.6 },
      ]
    },
    {
      id: 'hyatt', name: 'World of Hyatt', short: 'Hyatt',
      icon: '🟤', color: '#5C2D91', textColor: '#fff', category: 'hotel',
      cards: ['World of Hyatt Credit Card', 'World of Hyatt Business'],
      baseCpp: 2.0,
      partners: [
        { name: 'American AAdvantage', icon: '🦅', ratio: '1:1', type: 'airline', quality: 'good', cpp: 1.2 },
      ]
    },
    {
      id: 'hilton_honors', name: 'Hilton Honors', short: 'Hilton',
      icon: '🟡', color: '#134F92', textColor: '#fff', category: 'hotel',
      cards: ['Hilton Honors Aspire', 'Hilton Honors Surpass', 'Hilton Honors Card'],
      baseCpp: 0.5,
      partners: [
        { name: 'Amazon',  icon: '📦', ratio: '10:1', type: 'hotel', quality: 'good', cpp: 0.4 },
      ]
    },
    {
      id: 'ihg_rewards', name: 'IHG One Rewards', short: 'IHG',
      icon: '🟠', color: '#00539B', textColor: '#fff', category: 'hotel',
      cards: ['IHG One Rewards Premier', 'IHG One Rewards Traveler'],
      baseCpp: 0.7,
      partners: [
        { name: 'United MileagePlus',  icon: '🌐', ratio: '5:1', type: 'airline', quality: 'good', cpp: 0.8 },
        { name: 'American AAdvantage', icon: '🦅', ratio: '5:1', type: 'airline', quality: 'good', cpp: 0.8 },
        { name: 'British Airways',     icon: '🇬🇧', ratio: '5:1', type: 'airline', quality: 'good', cpp: 0.9 },
      ]
    },
  ];

  // ── Flight recommendations by route category ──────────────────────────────

  readonly flightRecs: Record<string, Recommendation[]> = {
    transatlantic: [
      { program: 'Virgin Atlantic Flying Club', partner: 'via Delta/Air France/ANA',  cpp: 2.1, ptsBase: 50000, cards: ['amex_mr','chase_ur','citi_ty'], note: 'Upper class from 50K pts' },
      { program: 'Air France Flying Blue',       partner: 'on Air France/KLM',         cpp: 1.9, ptsBase: 55000, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Promo awards drop monthly' },
      { program: 'British Airways Avios',        partner: 'on BA/AA/Iberia',            cpp: 1.8, ptsBase: 57500, cards: ['amex_mr','chase_ur','cap1_miles'], note: 'Distance-based — great for short hops' },
      { program: 'ANA Mileage Club',             partner: 'on United/Lufthansa',        cpp: 2.4, ptsBase: 88000, cards: ['amex_mr'], note: 'Best value in Business round-trip' },
      { program: 'Turkish Miles&Smiles',         partner: 'on Turkish/Star Alliance',   cpp: 2.3, ptsBase: 45000, cards: ['citi_ty','cap1_miles'], note: 'Incredible Business Class pricing' },
    ],
    transpacific: [
      { program: 'ANA Mileage Club',             partner: 'on ANA/United',              cpp: 2.4, ptsBase: 88000, cards: ['amex_mr'], note: 'Best for Japan routes' },
      { program: 'Air Canada Aeroplan',          partner: 'on Star Alliance',            cpp: 2.0, ptsBase: 75000, cards: ['amex_mr','chase_ur','cap1_miles','bilt'], note: 'No fuel surcharges on many partners' },
      { program: 'Singapore KrisFlyer',          partner: 'on Singapore/Star Alliance',  cpp: 2.2, ptsBase: 89000, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Suites class — unmatched experience' },
      { program: 'Virgin Atlantic Flying Club',  partner: 'on ANA',                     cpp: 2.5, ptsBase: 60000, cards: ['amex_mr','chase_ur','citi_ty'], note: 'ANA First via Virgin — huge sweet spot' },
      { program: 'Korean Air SkyPass',           partner: 'on Korean/Delta',             cpp: 1.8, ptsBase: 70000, cards: ['delta_skymiles'], note: 'Seoul and beyond — great Star award pricing' },
    ],
    domestic: [
      { program: 'Alaska MileagePlan',     partner: 'on Alaska/AA/BA',           cpp: 1.8, ptsBase: 12500, cards: ['bilt','alaska_mp'], note: 'Best domestic saver awards' },
      { program: 'Air Canada Aeroplan',    partner: 'on United (nearside US)',    cpp: 1.7, ptsBase: 12500, cards: ['amex_mr','chase_ur','cap1_miles'], note: 'Great for short United hops' },
      { program: 'Southwest Rapid Rewards',partner: 'on Southwest',              cpp: 1.5, ptsBase: 12000, cards: ['chase_ur','southwest_rr'], note: 'Great Companion Pass strategy' },
      { program: 'American AAdvantage',    partner: 'on AA domestic',             cpp: 1.5, ptsBase: 12500, cards: ['bilt','aa_aadvantage'], note: 'Web specials go low' },
      { program: 'United MileagePlus',     partner: 'on United domestic',         cpp: 1.4, ptsBase: 12500, cards: ['chase_ur','bilt','united_mp'], note: 'Saver awards on off-peak routes' },
    ],
    default: [
      { program: 'Air Canada Aeroplan',          partner: 'on Star Alliance worldwide',  cpp: 1.8, ptsBase: 35000, cards: ['amex_mr','chase_ur','cap1_miles','bilt'], note: 'Most flexible, no fuel surcharges' },
      { program: 'Turkish Miles&Smiles',         partner: 'on Star Alliance',            cpp: 2.3, ptsBase: 45000, cards: ['citi_ty','cap1_miles'], note: 'Incredible Business pricing' },
      { program: 'Singapore KrisFlyer',          partner: 'on Singapore/partners',       cpp: 2.2, ptsBase: 62500, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Best First Class value' },
      { program: 'Virgin Atlantic Flying Club',  partner: 'on Delta/ANA/Air France',     cpp: 2.1, ptsBase: 50000, cards: ['amex_mr','chase_ur','citi_ty'], note: 'Widely transferable' },
      { program: 'Air France Flying Blue',       partner: 'on Air France/KLM',           cpp: 1.9, ptsBase: 50000, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Monthly promos — watch for deals' },
    ]
  };

  // ── Hotel recommendations by category ────────────────────────────────────

  readonly hotelRecs: Record<string, Recommendation[]> = {
    luxury: [
      { program: 'World of Hyatt',   partner: 'Park Hyatt / Alila / Andaz',           cpp: 2.1, ptsBase: 30000, cards: ['chase_ur','bilt','hyatt'], note: 'Best CPP of any hotel program' },
      { program: 'Marriott Bonvoy',  partner: 'St. Regis / Ritz-Carlton',             cpp: 1.0, ptsBase: 85000, cards: ['amex_mr','chase_ur','bilt','marriott_bonvoy'], note: '5th night free on 5-night stays' },
      { program: 'IHG One Rewards',  partner: 'InterContinental / Kimpton',            cpp: 0.8, ptsBase: 70000, cards: ['chase_ur','ihg_rewards'], note: 'Combine with annual free night cert' },
    ],
    mid: [
      { program: 'World of Hyatt',   partner: 'Hyatt Place / Hyatt House',            cpp: 2.0, ptsBase: 15000, cards: ['chase_ur','bilt','hyatt'], note: 'Category 4 properties sweet spot' },
      { program: 'Marriott Bonvoy',  partner: 'Westin / Sheraton / JW',               cpp: 0.9, ptsBase: 35000, cards: ['amex_mr','chase_ur','bilt','marriott_bonvoy'], note: 'Off-peak pricing helps value' },
      { program: 'Hilton Honors',    partner: 'DoubleTree / Embassy Suites',           cpp: 0.6, ptsBase: 40000, cards: ['amex_mr','hilton_honors'], note: '5th night free with Amex Hilton cards' },
    ],
    budget: [
      { program: 'Wyndham Rewards',  partner: 'La Quinta / Travelodge',               cpp: 1.1, ptsBase: 7500,  cards: ['citi_ty','cap1_miles'], note: 'Consistent value in budget tiers' },
      { program: 'Hilton Honors',    partner: 'Hampton / Hilton Garden Inn',           cpp: 0.6, ptsBase: 30000, cards: ['amex_mr','hilton_honors'], note: 'Use 5th night free benefit' },
      { program: 'IHG One Rewards',  partner: 'Holiday Inn / Staybridge',              cpp: 0.7, ptsBase: 25000, cards: ['chase_ur','ihg_rewards'], note: 'Reliable mid-budget choice' },
    ],
    top: [
      { program: 'World of Hyatt',   partner: 'Park Hyatt Tokyo / Maldives',          cpp: 2.4, ptsBase: 45000, cards: ['chase_ur','bilt','hyatt'], note: 'Cat 7–8 worth $800+/night' },
      { program: 'Marriott Bonvoy',  partner: 'St. Regis / Ritz-Carlton',             cpp: 1.0, ptsBase: 85000, cards: ['amex_mr','chase_ur','bilt','marriott_bonvoy'], note: '5th night free on 5-night redemption' },
      { program: 'Hilton Honors',    partner: 'Conrad / Waldorf Astoria',             cpp: 0.6, ptsBase: 95000, cards: ['amex_mr','hilton_honors'], note: 'Watch for 5th night free' },
    ],
    default: [
      { program: 'World of Hyatt',   partner: 'Hyatt portfolio worldwide',            cpp: 2.0, ptsBase: 25000, cards: ['chase_ur','bilt','hyatt'], note: 'Highest consistent value in hotels' },
      { program: 'Marriott Bonvoy',  partner: 'Marriott / Westin / Sheraton',         cpp: 0.9, ptsBase: 45000, cards: ['amex_mr','chase_ur','bilt','marriott_bonvoy'], note: 'Largest portfolio' },
      { program: 'Hilton Honors',    partner: 'Conrad / Waldorf Astoria',             cpp: 0.6, ptsBase: 95000, cards: ['amex_mr','hilton_honors'], note: 'Watch for 5th night free' },
    ]
  };

  // ── Sweet spots ───────────────────────────────────────────────────────────

  readonly sweetSpots: SweetSpot[] = [
    // Flights
    {
      route: 'US → Japan (Business)', detail: 'ANA Business Class roundtrip via Star Alliance',
      ptsNeeded: '88,000', estCash: '$5,000+', cpp: '5.7¢',
      cards: ['Amex MR'], programs: ['ANA Mileage Club'], category: 'flight',
      note: 'Best Business Class deal in points. No fuel surcharges. Book 355 days out on ANA.com.'
    },
    {
      route: 'US → Japan (First)', detail: 'ANA First Class via Virgin Atlantic transfer',
      ptsNeeded: '60,000', estCash: '$15,000+', cpp: '25¢',
      cards: ['Amex MR', 'Chase UR', 'Citi TY'], programs: ['Virgin Atlantic Flying Club'], category: 'flight',
      note: 'The holy grail. Virgin charges just 60K for ANA First one-way. Availability is extremely limited — search on ANA.com first.'
    },
    {
      route: 'US → Europe (Business)', detail: 'Virgin Atlantic to fly Delta One / Air France',
      ptsNeeded: '50,000', estCash: '$4,000+', cpp: '8.0¢',
      cards: ['Amex MR', 'Chase UR', 'Citi TY'], programs: ['Virgin Atlantic Flying Club'], category: 'flight',
      note: 'One of the most consistent transatlantic sweet spots. Transfer on demand — no fuel surcharges.'
    },
    {
      route: 'US → Europe (Business)', detail: 'Turkish Miles&Smiles on Star Alliance',
      ptsNeeded: '45,000', estCash: '$3,500+', cpp: '7.7¢',
      cards: ['Citi TY', 'Cap1 Miles'], programs: ['Turkish Miles&Smiles'], category: 'flight',
      note: 'Incredible pricing for Star Alliance Business Class. Book only on turkish.com — call if not available online.'
    },
    {
      route: 'US → Europe (Business)', detail: 'ANA Mileage Club on Lufthansa/United',
      ptsNeeded: '88,000', estCash: '$5,000+', cpp: '5.7¢',
      cards: ['Amex MR'], programs: ['ANA Mileage Club'], category: 'flight',
      note: 'Round-trip Business in ANA\'s allotment on Lufthansa or United. Best for Europe in style.'
    },
    {
      route: 'US → Pacific / Asia (Business)', detail: 'Singapore KrisFlyer on Singapore Airlines',
      ptsNeeded: '89,000', estCash: '$7,000+', cpp: '7.9¢',
      cards: ['Amex MR', 'Chase UR', 'Citi TY', 'Cap1'], programs: ['Singapore KrisFlyer'], category: 'flight',
      note: 'World-class product. Transfer then book through KrisFlyer — no carrier surcharges.'
    },
    {
      route: 'US Short Haul', detail: 'Alaska Saver Awards on American Airlines',
      ptsNeeded: '12,500', estCash: '$250–400', cpp: '2.4¢',
      cards: ['Bilt'], programs: ['Alaska MileagePlan'], category: 'flight',
      note: 'Only Bilt transfers to Alaska. Saver space on AA can be easier to find than AAdvantage.'
    },
    {
      route: 'US → Caribbean / Mexico', detail: 'American AAdvantage Web Specials',
      ptsNeeded: '15,000', estCash: '$300–600', cpp: '2.5¢',
      cards: ['Bilt'], programs: ['American AAdvantage'], category: 'flight',
      note: 'Web Special awards available from $0–15K to Mexico/Caribbean in economy. Check AA.com on Tuesdays.'
    },
    {
      route: 'Open-jaw routes worldwide', detail: 'Air Canada Aeroplan — no fuel surcharges',
      ptsNeeded: '35,000+', estCash: 'Varies', cpp: '2.0¢+',
      cards: ['Amex MR', 'Chase UR', 'Cap1', 'Bilt'], programs: ['Air Canada Aeroplan'], category: 'flight',
      note: 'No fuel surcharges on most partners. Allows open-jaw and stopovers. Best all-around program.'
    },

    // Hotels
    {
      route: 'Park Hyatt Tokyo', detail: '5-night stay at one of the world\'s best hotels',
      ptsNeeded: '225,000', estCash: '$5,000+', cpp: '2.2¢',
      cards: ['Chase UR', 'Bilt'], programs: ['World of Hyatt'], category: 'hotel',
      note: 'Cat 7. Book at exactly 13 months for best availability. The Lost in Translation hotel.'
    },
    {
      route: 'Hyatt Category 1–4', detail: 'Mid-range Hyatts: reliable CPP floor',
      ptsNeeded: '5,000–15,000/night', estCash: '$150–400/night', cpp: '2.0¢+',
      cards: ['Chase UR', 'Bilt'], programs: ['World of Hyatt'], category: 'hotel',
      note: 'Even "boring" Hyatt properties deliver 2¢+ reliably. Stash Chase UR exclusively for Hyatt.'
    },
    {
      route: 'Marriott Category 1–4', detail: '5-night stay — get the 5th night free',
      ptsNeeded: '4× night rate', estCash: '5× night rate', cpp: '1.5¢+',
      cards: ['Amex MR', 'Chase UR', 'Bilt'], programs: ['Marriott Bonvoy'], category: 'hotel',
      note: 'Book 5 nights, pay 4 in points. Stacks to 25% better value on every 5-night stay.'
    },
    {
      route: 'IHG Free Night Cert', detail: 'Annual free night worth up to 40K points/year',
      ptsNeeded: '0', estCash: '$200–500', cpp: '∞',
      cards: ['Chase UR'], programs: ['IHG One Rewards'], category: 'hotel',
      note: 'The IHG Premier card gives a free night cert every anniversary — often worth more than the annual fee alone.'
    },

    // Promos
    {
      route: 'Flying Blue Promo Awards', detail: 'Monthly flash sales — Air France / KLM routes',
      ptsNeeded: 'Varies (30–50% off)', estCash: 'Varies', cpp: '2.0¢+',
      cards: ['Amex MR', 'Chase UR', 'Citi TY', 'Cap1'], programs: ['Air France/KLM Flying Blue'], category: 'promo',
      note: 'Every month Flying Blue publishes Promo Awards with 25–50% off. Set alerts — deals disappear fast.'
    },
    {
      route: 'Southwest Companion Pass', detail: 'Fly 2-for-1 for up to 2 years',
      ptsNeeded: '135,000 in a calendar year', estCash: 'Priceless', cpp: '3.0¢+',
      cards: ['Chase UR'], programs: ['Southwest Rapid Rewards'], category: 'promo',
      note: 'The best deal in domestic travel. Earn 135K RR points in one calendar year — companion flies free for rest of that year + the next. Time it: earn the 135K in January.'
    },
    {
      route: 'Amex Transfer Bonuses', detail: 'Periodic 20–40% transfer bonuses',
      ptsNeeded: 'Varies', estCash: 'Varies', cpp: '3.0¢+',
      cards: ['Amex MR'], programs: ['Various'], category: 'promo',
      note: 'Amex periodically offers 20–40% transfer bonuses to specific partners (often Aeroplan, Virgin, BA). Never transfer MR without checking current bonuses first.'
    },
  ];

  // ── Transfer bonuses ─────────────────────────────────────────────────────
  // Manually updated when major promos are announced.
  // Dates are approximate — verify with program before transferring.
  readonly transferBonuses: TransferBonus[] = [
    {
      from: 'Amex MR', fromId: 'amex_mr',
      to: 'Air France/KLM Flying Blue', toIcon: '🇫🇷',
      bonus: '30% bonus', expires: '2026-06-30',
      note: 'Transfer Amex MR → Flying Blue and receive 30% extra miles. Cap: 100K bonus miles.',
    },
    {
      from: 'Amex MR', fromId: 'amex_mr',
      to: 'Virgin Atlantic Flying Club', toIcon: '✈',
      bonus: '25% bonus', expires: '2026-05-31',
      note: 'Rare Virgin Atlantic bonus. Great for ANA and Delta redemptions via VS miles.',
    },
    {
      from: 'Chase UR', fromId: 'chase_ur',
      to: 'Air Canada Aeroplan', toIcon: '🍁',
      bonus: '20% bonus', expires: '2026-07-15',
      note: 'Chase → Aeroplan bonus gives extra leverage on open-jaw and Star Alliance awards.',
    },
    {
      from: 'Citi TY', fromId: 'citi_ty',
      to: 'Turkish Miles&Smiles', toIcon: '🌙',
      bonus: '30% bonus', expires: '2026-05-15',
      note: 'Turkish Miles&Smiles offers incredible Star Alliance business class redemptions. This bonus makes them even better value.',
    },
  ];
}

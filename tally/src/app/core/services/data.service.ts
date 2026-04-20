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
    hawaii: [
      { program: 'Alaska MileagePlan',      partner: 'on Alaska/AA from mainland US', cpp: 2.1, ptsBase: 12500, cards: ['bilt','alaska_mp'], note: 'Best mainland↔Hawaii deal — Saver awards from 12,500 pts one-way' },
      { program: 'British Airways Avios',    partner: 'on Alaska codeshares',          cpp: 1.9, ptsBase: 7500,  cards: ['amex_mr','chase_ur','cap1_miles'], note: 'Distance-based pricing — as low as 7,500 Avios one-way on Alaska codeshares' },
      { program: 'Southwest Rapid Rewards',  partner: 'on Southwest to Hawaii',        cpp: 1.5, ptsBase: 18000, cards: ['chase_ur','southwest_rr'], note: 'HNL, OGG, KOA, LIH all served. Best with the Companion Pass' },
      { program: 'American AAdvantage',      partner: 'on AA to Honolulu/Maui',        cpp: 1.5, ptsBase: 17500, cards: ['bilt','aa_aadvantage'], note: 'Web Specials drop Tuesdays — Hawaii routes included seasonally' },
      { program: 'United MileagePlus',       partner: 'on United to Hawaii',           cpp: 1.4, ptsBase: 15000, cards: ['chase_ur','bilt','united_mp'], note: 'Saver awards on off-peak dates — check United.com for Economy Saver space' },
    ],
    latin_america: [
      { program: 'Air Canada Aeroplan',    partner: 'on Star Alliance to Brazil/Andean', cpp: 1.8, ptsBase: 30000, cards: ['amex_mr','chase_ur','cap1_miles','bilt'], note: 'No fuel surcharges, flexible routing' },
      { program: 'Avianca LifeMiles',      partner: 'on Avianca/Star Alliance',          cpp: 1.7, ptsBase: 28000, cards: ['citi_ty','cap1_miles'], note: 'Great South America coverage' },
      { program: 'American AAdvantage',    partner: 'on AA to LatAm',                    cpp: 1.6, ptsBase: 30000, cards: ['bilt','aa_aadvantage'], note: 'Decent south of border awards' },
      { program: 'Air France Flying Blue', partner: 'on Air France to Brazil',           cpp: 1.5, ptsBase: 37500, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Promo awards often apply here' },
    ],
    caribbean: [
      { program: 'American AAdvantage',    partner: 'on AA to Caribbean',         cpp: 1.8, ptsBase: 20000, cards: ['bilt','aa_aadvantage'], note: 'Excellent Caribbean network' },
      { program: 'JetBlue TrueBlue',       partner: 'on JetBlue to Caribbean',    cpp: 1.5, ptsBase: 18000, cards: ['citi_ty'], note: 'Great for Barbados, Jamaica routes' },
      { program: 'Alaska MileagePlan',     partner: 'on AA/BA/oneworld',           cpp: 1.6, ptsBase: 17500, cards: ['bilt','alaska_mp'], note: 'Consistent award pricing' },
      { program: 'British Airways Avios',  partner: 'on AA to Caribbean short hops', cpp: 1.8, ptsBase: 9000, cards: ['amex_mr','chase_ur','cap1_miles'], note: 'Distance-based — very cheap for short hops' },
    ],
    middle_east: [
      { program: 'Turkish Miles&Smiles',  partner: 'on Turkish to Middle East',   cpp: 2.2, ptsBase: 42500, cards: ['citi_ty','cap1_miles'], note: 'Amazing Business Class pricing' },
      { program: 'Air Canada Aeroplan',   partner: 'on Star Alliance to Gulf',    cpp: 1.8, ptsBase: 55000, cards: ['amex_mr','chase_ur','cap1_miles','bilt'], note: 'No fuel surcharges' },
      { program: 'ANA Mileage Club',      partner: 'on Lufthansa to Israel/ME',   cpp: 2.0, ptsBase: 60000, cards: ['amex_mr'], note: 'Avoid Lufthansa fuel surcharges via ANA awards' },
      { program: 'British Airways Avios', partner: 'on AA/BA to UAE',             cpp: 1.7, ptsBase: 80000, cards: ['amex_mr','chase_ur','cap1_miles'], note: 'Check partner award space on aa.com' },
    ],
    africa: [
      { program: 'Air Canada Aeroplan',   partner: 'on Star Alliance to Africa',  cpp: 1.9, ptsBase: 75000, cards: ['amex_mr','chase_ur','cap1_miles','bilt'], note: 'Ethiopian, South African partners' },
      { program: 'Turkish Miles&Smiles',  partner: 'on Turkish/Star Alliance',    cpp: 2.1, ptsBase: 70000, cards: ['citi_ty','cap1_miles'], note: 'Turkish flies to 60+ African cities' },
      { program: 'Air France Flying Blue', partner: 'on Air France to W/N Africa', cpp: 1.7, ptsBase: 75000, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Best network for West Africa' },
      { program: 'American AAdvantage',   partner: 'on oneworld to S. Africa',    cpp: 1.5, ptsBase: 80000, cards: ['bilt','aa_aadvantage'], note: 'British Airways to JNB via LHR' },
    ],
    eurasia: [
      { program: 'Turkish Miles&Smiles',  partner: 'on Turkish across Eurasia',   cpp: 2.3, ptsBase: 42500, cards: ['citi_ty','cap1_miles'], note: 'Incredible Star Alliance pricing Europe↔Asia' },
      { program: 'Air Canada Aeroplan',   partner: 'on Star Alliance EU↔Asia',    cpp: 1.8, ptsBase: 72500, cards: ['amex_mr','chase_ur','cap1_miles','bilt'], note: 'No fuel surcharges on most partners' },
      { program: 'Singapore KrisFlyer',   partner: 'on Singapore EU routes',      cpp: 2.0, ptsBase: 91000, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Great for Europe↔Singapore/India' },
      { program: 'ANA Mileage Club',      partner: 'on Lufthansa/United EU↔Asia', cpp: 2.2, ptsBase: 85000, cards: ['amex_mr'], note: 'Round-the-world style routing possible' },
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
      { program: 'World of Hyatt',   partner: 'Park Hyatt / Alila / Andaz',           cpp: 2.1, ptsBase: 30000, cards: ['chase_ur','bilt','hyatt'],                     note: 'Best CPP of any hotel program. Book 13 months out.' },
      { program: 'World of Hyatt',   partner: 'Small Luxury Hotels (SLH)',            cpp: 2.0, ptsBase: 25000, cards: ['chase_ur','bilt','hyatt'],                     note: 'Hyatt members can book 500+ SLH boutique hotels with points — often Cat 1–4.' },
      { program: 'IHG One Rewards',  partner: 'Six Senses Resorts',                  cpp: 1.5, ptsBase: 60000, cards: ['chase_ur','ihg_rewards'],                     note: 'IHG acquired Six Senses. Maldives, Fiji, and Oman properties bookable with points.' },
      { program: 'Marriott Bonvoy',  partner: 'St. Regis / Ritz-Carlton',            cpp: 1.0, ptsBase: 85000, cards: ['amex_mr','chase_ur','bilt','marriott_bonvoy'], note: '5th night free on 5-night stays boosts effective CPP.' },
    ],
    mid: [
      { program: 'World of Hyatt',   partner: 'Hyatt Place / Hyatt House',           cpp: 2.0, ptsBase: 15000, cards: ['chase_ur','bilt','hyatt'],                     note: 'Category 4 properties are the sweet spot — cities + resorts.' },
      { program: 'World of Hyatt',   partner: 'Joie de Vivre / Thompson Hotels',     cpp: 1.9, ptsBase: 18000, cards: ['chase_ur','bilt','hyatt'],                     note: 'Boutique brands at mid-tier Hyatt points rates. NYC, Chicago, Nashville, LA.' },
      { program: 'Marriott Bonvoy',  partner: 'Westin / Sheraton / JW',              cpp: 0.9, ptsBase: 35000, cards: ['amex_mr','chase_ur','bilt','marriott_bonvoy'], note: 'Off-peak pricing helps. 5th night free is automatic.' },
      { program: 'Hilton Honors',    partner: 'DoubleTree / Embassy Suites',         cpp: 0.6, ptsBase: 40000, cards: ['amex_mr','hilton_honors'],                     note: '5th night free with Amex Hilton cards.' },
    ],
    budget: [
      { program: 'Wyndham Rewards',  partner: 'La Quinta / Travelodge',              cpp: 1.1, ptsBase: 7500,  cards: ['citi_ty','cap1_miles'],                       note: 'Consistent value in budget tiers. No fuel surcharges, flat pricing.' },
      { program: 'IHG One Rewards',  partner: 'Holiday Inn / Staybridge',            cpp: 0.7, ptsBase: 25000, cards: ['chase_ur','ihg_rewards'],                     note: 'IHG Premier card annual free night cert alone pays for itself here.' },
      { program: 'Hilton Honors',    partner: 'Hampton / Hilton Garden Inn',         cpp: 0.6, ptsBase: 30000, cards: ['amex_mr','hilton_honors'],                     note: '5th night free benefit available. Amex Hilton card earns 3–7× on spending.' },
    ],
    top: [
      { program: 'World of Hyatt',   partner: 'Park Hyatt Maldives / Tokyo / Paris', cpp: 2.4, ptsBase: 45000, cards: ['chase_ur','bilt','hyatt'],                     note: 'Cat 7–8 worth $800–3,000/night. The best hotel points deal in existence.' },
      { program: 'IHG One Rewards',  partner: 'Six Senses Maldives / Laamu',        cpp: 1.8, ptsBase: 80000, cards: ['chase_ur','ihg_rewards'],                     note: 'Six Senses all-inclusives are some of the world\'s most expensive hotels — bookable with IHG points.' },
      { program: 'Marriott Bonvoy',  partner: 'St. Regis Maldives / Bora Bora',    cpp: 1.0, ptsBase: 100000,cards: ['amex_mr','chase_ur','bilt','marriott_bonvoy'], note: '5th night free — critical on 5-night stays at $2,000+/night properties.' },
      { program: 'Hilton Honors',    partner: 'Conrad / Waldorf Astoria',           cpp: 0.6, ptsBase: 95000, cards: ['amex_mr','hilton_honors'],                     note: 'Conrad Bora Bora is a standout. Use 5th night free on a 5-night stay.' },
    ],
    default: [
      { program: 'World of Hyatt',   partner: 'Hyatt portfolio worldwide',          cpp: 2.0, ptsBase: 25000, cards: ['chase_ur','bilt','hyatt'],                     note: 'Highest consistent hotel CPP. Best for flexible travelers.' },
      { program: 'IHG One Rewards',  partner: 'Six Senses / InterContinental',     cpp: 1.2, ptsBase: 60000, cards: ['chase_ur','ihg_rewards'],                     note: 'IHG annual free night cert is often worth $300+ on its own.' },
      { program: 'Marriott Bonvoy',  partner: 'Marriott / Westin / Sheraton',      cpp: 0.9, ptsBase: 45000, cards: ['amex_mr','chase_ur','bilt','marriott_bonvoy'], note: 'Largest hotel portfolio worldwide. 5th night free is automatic.' },
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

    // More Flight Sweet Spots
    {
      route: 'US → Maldives (Business)', detail: 'Qatar Airways Qsuite via Star Alliance partners',
      ptsNeeded: '70,000', estCash: '$6,000+', cpp: '8.6¢',
      cards: ['Amex MR', 'Chase UR'], programs: ['Air Canada Aeroplan'], category: 'flight',
      note: 'Aeroplan books Qatar Qsuites without fuel surcharges. One of the few programs that does. Book via Air Canada app/site.'
    },
    {
      route: 'US → Australia (Business)', detail: 'Qantas Business via partner awards',
      ptsNeeded: '80,000', estCash: '$8,000+', cpp: '10¢',
      cards: ['Amex MR', 'Chase UR', 'Citi TY'], programs: ['Air Canada Aeroplan'], category: 'flight',
      note: 'Aeroplan → Qantas Business without brutal fuel surcharges. Far cheaper than booking through Qantas directly.'
    },
    {
      route: 'US → South Africa (Business)', detail: 'Star Alliance to JNB via Ethiopian/South African',
      ptsNeeded: '75,000', estCash: '$5,000+', cpp: '6.7¢',
      cards: ['Amex MR', 'Chase UR', 'Cap1'], programs: ['Air Canada Aeroplan'], category: 'flight',
      note: 'Underrated route. Aeroplan prices Star Alliance partners without fuel surcharges — the only sensible way to book this in Business.'
    },
    {
      route: 'US → India (Business)', detail: 'Air India via Star Alliance or Lufthansa',
      ptsNeeded: '60,000', estCash: '$3,500+', cpp: '5.8¢',
      cards: ['Citi TY', 'Cap1'], programs: ['Turkish Miles&Smiles'], category: 'flight',
      note: 'Turkish prices Star Alliance partners incredibly low — Lufthansa Business to BOM/DEL is a steal vs. cash fares.'
    },
    {
      route: 'US → Brazil (Business)', detail: 'Avianca LifeMiles on LATAM/United to GRU',
      ptsNeeded: '63,000', estCash: '$3,000+', cpp: '4.8¢',
      cards: ['Citi TY', 'Cap1'], programs: ['Avianca LifeMiles'], category: 'flight',
      note: 'Avianca LifeMiles prices South American routes well. Watch for transfer bonuses — they run them periodically.'
    },
    {
      route: 'US → Hawaii (Economy)', detail: 'Hawaiian Airlines or Alaska on AA/BA Avios',
      ptsNeeded: '7,500', estCash: '$250–400', cpp: '3.7¢',
      cards: ['Amex MR', 'Chase UR'], programs: ['British Airways Avios'], category: 'flight',
      note: 'Short hop? Avios is distance-based. Mainland → Hawaii on Alaska codeshares can go as low as 7,500 Avios one-way.'
    },

    // More Hotel Sweet Spots
    {
      route: 'Conrad Bora Bora Overwater Villa', detail: 'Hilton Honors Category 10',
      ptsNeeded: '120,000/night', estCash: '$2,500+/night', cpp: '2.1¢',
      cards: ['Amex MR'], programs: ['Hilton Honors'], category: 'hotel',
      note: 'One of the few places where Hilton Honors delivers elite value. The villa rate makes the math compelling. Use the 5th night free on a 5-night stay.'
    },
    {
      route: 'Park Hyatt Maldives Hadahaa', detail: 'World of Hyatt Category 7',
      ptsNeeded: '40,000/night', estCash: '$1,500+/night', cpp: '3.8¢',
      cards: ['Chase UR', 'Bilt'], programs: ['World of Hyatt'], category: 'hotel',
      note: 'Hands down the best CPP in Hyatt\'s portfolio. An all-inclusive private island experience for 40K points.'
    },
    {
      route: 'Marriott Cat 1–4 in Asia/Europe', detail: '5-night stays with 5th night free',
      ptsNeeded: '4× 30,000', estCash: '5× $200–400', cpp: '1.5–2.0¢',
      cards: ['Amex MR', 'Chase UR', 'Bilt'], programs: ['Marriott Bonvoy'], category: 'hotel',
      note: 'Lesser-known in Asia/Europe: Category 3–4 Marriotts in Japan, Prague, Barcelona cash out at 1.8–2¢+ on 5-night stays.'
    },

    // More flight sweet spots
    {
      route: 'US → Middle East (Business)', detail: 'Emirates Business via partner programs',
      ptsNeeded: '72,000', estCash: '$5,000+', cpp: '6.9¢',
      cards: ['Amex MR', 'Chase UR', 'Cap1'], programs: ['Air Canada Aeroplan'], category: 'flight',
      note: 'Aeroplan books Emirates Business without astronomical fuel surcharges. Open-jaw DXB/AUH works too.'
    },
    {
      route: 'US → Singapore (Suites)', detail: 'Singapore Airlines First Class via KrisFlyer',
      ptsNeeded: '75,000', estCash: '$25,000+', cpp: '33¢',
      cards: ['Amex MR', 'Chase UR', 'Citi TY', 'Cap1'], programs: ['Singapore KrisFlyer'], category: 'flight',
      note: 'The pinnacle of luxury travel. SQ Suites one-way. Transfer on demand; availability opens 3.5 days before departure (last-minute game).'
    },
    {
      route: 'US → Europe (Economy)', detail: 'Iberia Avios on Iberia / British Airways',
      ptsNeeded: '17,000–34,000', estCash: '$500–800', cpp: '2.5¢',
      cards: ['Amex MR', 'Chase UR'], programs: ['British Airways Avios'], category: 'flight',
      note: 'Iberia uses a zone-based chart — transatlantic economy from just 17K Avios off-peak. Best for MAD/BCN routes. Avoid fuel surcharges by routing through Iberia.com.'
    },
    {
      route: 'US → Asia / Pacific (Business)', detail: 'Cathay Pacific via Alaska MileagePlan',
      ptsNeeded: '70,000', estCash: '$8,000+', cpp: '11.4¢',
      cards: ['Bilt'], programs: ['Alaska MileagePlan'], category: 'flight',
      note: 'Alaska MileagePlan prices Cathay Pacific Business at 70K one-way. Only Bilt transfers to Alaska. Extraordinary value — Cathay is a top-5 airline globally.'
    },

    // More hotel sweet spots
    {
      route: 'Andaz in Mexico / Caribbean', detail: 'World of Hyatt Cat 1–4 boutique properties',
      ptsNeeded: '8,000–15,000/night', estCash: '$300–600/night', cpp: '2.7¢',
      cards: ['Chase UR', 'Bilt'], programs: ['World of Hyatt'], category: 'hotel',
      note: 'Andaz Mayakoba (Cat 4) and Andaz Papagayo deliver resort value at hotel-point rates. Book with Chase UR transferred at 1:1.'
    },
    {
      route: 'Alila / Ventana Villas', detail: 'Hyatt all-inclusive and boutique properties',
      ptsNeeded: '20,000–30,000/night', estCash: '$600–1,200/night', cpp: '3.5¢',
      cards: ['Chase UR', 'Bilt'], programs: ['World of Hyatt'], category: 'hotel',
      note: 'Alila Ventana Big Sur and similar Hyatt Unbound properties offer incredible CPP. Limited award availability — book 13 months out.'
    },

    // Additional flight sweet spots
    {
      route: 'US → London (First)', detail: 'JAL First Class via Alaska MileagePlan',
      ptsNeeded: '70,000', estCash: '$20,000+', cpp: '28¢',
      cards: ['Bilt'], programs: ['Alaska MileagePlan'], category: 'flight',
      note: 'JAL First Class "Suites" is world-class. Alaska prices it at 70K one-way — only Bilt transfers to Alaska. Awards open 11 days before departure (last-minute strategy).'
    },
    {
      route: 'US → London (Business)', detail: 'Qatar Qsuites via Air Canada Aeroplan',
      ptsNeeded: '70,000', estCash: '$5,500+', cpp: '7.9¢',
      cards: ['Amex MR', 'Chase UR', 'Cap1', 'Bilt'], programs: ['Air Canada Aeroplan'], category: 'flight',
      note: 'Aeroplan books Qatar Qsuites — the double-bed Business suite — without fuel surcharges. Far better value than booking through Qatar directly.'
    },
    {
      route: 'US → Europe (Economy)', detail: 'Air Canada Aeroplan off-peak economy',
      ptsNeeded: '22,500', estCash: '$700–1,200', cpp: '3.5¢',
      cards: ['Amex MR', 'Chase UR', 'Cap1', 'Bilt'], programs: ['Air Canada Aeroplan'], category: 'flight',
      note: 'Aeroplan off-peak transatlantic economy starts at 22,500 miles. No fuel surcharges on most Star Alliance partners. Best value for economy class.'
    },
    {
      route: 'US → Tokyo (Business)', detail: 'JAL Business Class via Alaska MileagePlan',
      ptsNeeded: '60,000', estCash: '$7,000+', cpp: '11.7¢',
      cards: ['Bilt'], programs: ['Alaska MileagePlan'], category: 'flight',
      note: 'JAL Business (Sky Suite) via Alaska at 60K one-way. Awards open late but the product rivals ANA. Only Bilt transfers to Alaska — a key Bilt advantage.'
    },

    // Additional hotel sweet spots
    {
      route: 'Hyatt Andaz Costa Rica / Cancun', detail: 'World of Hyatt Category 4–5 beach resorts',
      ptsNeeded: '15,000–20,000/night', estCash: '$350–700/night', cpp: '2.7¢',
      cards: ['Chase UR', 'Bilt'], programs: ['World of Hyatt'], category: 'hotel',
      note: 'Andaz Costa Rica and Andaz Mayakoba deliver resort-level experiences at mid-tier points cost. Book 13 months ahead for peak dates.'
    },
    {
      route: 'Thompson Hotels (US Boutique)', detail: 'Hyatt urban boutique brand — Cat 4–5',
      ptsNeeded: '15,000–20,000/night', estCash: '$350–600/night', cpp: '2.5¢',
      cards: ['Chase UR', 'Bilt'], programs: ['World of Hyatt'], category: 'hotel',
      note: 'Thompson properties in NYC, Chicago, Nashville deliver boutique hotel experiences at great CPP. Often less competitive for award space than Park Hyatt.'
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
    {
      route: 'IHG Annual Free Night', detail: 'Worth up to 40,000 points/year',
      ptsNeeded: '0 extra (card benefit)', estCash: '$200–500', cpp: '∞',
      cards: ['Chase UR'], programs: ['IHG One Rewards'], category: 'promo',
      note: 'IHG Premier card annual free night cert is often worth $300+. Combine with IHG points for a free multi-night stay.'
    },
    {
      route: 'Bilt Rent Day (1st of Month)', detail: '3× points on all spend on the 1st',
      ptsNeeded: 'N/A', estCash: 'N/A', cpp: '3.0¢+ earned',
      cards: ['Bilt'], programs: ['Bilt Rewards'], category: 'promo',
      note: 'Every month on the 1st, Bilt offers 3× points on all purchases (normally 1×). Combined with Hyatt transfers, this is one of the best recurring earn opportunities.'
    },
    // ── Additional iconic sweet spots ─────────────────────────────────────
    {
      route: 'US → Frankfurt (First)', detail: 'Lufthansa First Class via United MileagePlus',
      ptsNeeded: '110,000', estCash: '$15,000+', cpp: '13.6¢',
      cards: ['Chase UR', 'Bilt'], programs: ['United MileagePlus'], category: 'flight',
      note: 'Lufthansa First with private terminal access in Frankfurt. Book on United.com up to 14 days before departure. United miles don\'t pass surcharges.'
    },
    {
      route: 'US → Australia (Business)', detail: 'Qantas Business via AAdvantage',
      ptsNeeded: '70,000', estCash: '$7,000+', cpp: '10.0¢',
      cards: ['Bilt'], programs: ['American AAdvantage'], category: 'flight',
      note: 'AAdvantage prices Qantas Business one-way at 70K. Only Bilt transfers to AA from a transferable currency. Check AA.com for Qantas Q class availability.'
    },
    {
      route: 'US / EU → Abu Dhabi (First)', detail: 'Etihad First Apartment via LifeMiles',
      ptsNeeded: '90,000', estCash: '$20,000+', cpp: '22.2¢',
      cards: ['Citi TY', 'Cap1 Miles'], programs: ['Avianca LifeMiles'], category: 'flight',
      note: 'The Etihad First Apartment is a private cabin-within-a-cabin. LifeMiles prices it without fuel surcharges — one of the best premium redemptions available.'
    },
    {
      route: 'Europe → Asia (Business)', detail: 'Ethiopian Star Alliance Business via Aeroplan',
      ptsNeeded: '57,500', estCash: '$4,000+', cpp: '7.0¢',
      cards: ['Amex MR', 'Chase UR', 'Cap1 Miles', 'Bilt'], programs: ['Air Canada Aeroplan'], category: 'flight',
      note: 'Aeroplan prices Europe → Asia Star Alliance business at 57.5K. Great for LHR/CDG → SIN/BKK/NRT. No fuel surcharges on most carriers.'
    },
    {
      route: 'US → Paris (First)', detail: 'Air France La Première via Flying Blue',
      ptsNeeded: '300,000', estCash: '$25,000+', cpp: '8.3¢',
      cards: ['Amex MR', 'Chase UR', 'Citi TY', 'Cap1 Miles'], programs: ['Air France/KLM Flying Blue'], category: 'flight',
      note: 'Air France La Première is the world\'s most exclusive cabin. Flying Blue occasionally releases last-minute award space. Watch for Flying Blue Promo Awards for 30–40% off.'
    },
    // ── New additions ───────────────────────────────────────────────────────
    {
      route: 'US → Europe (Business)', detail: 'Lufthansa / United Business via Turkish Miles&Smiles',
      ptsNeeded: '45,000', estCash: '$4,500+', cpp: '10.0¢',
      cards: ['Citi TY', 'Cap1 Miles'], programs: ['Turkish Miles&Smiles'], category: 'flight',
      note: 'Turkish prices transatlantic Star Alliance business at just 45K miles one-way — a fraction of what United or Lufthansa charge their own members. No fuel surcharges. Search on turkishairlines.com.',
      isNew: true,
    },
    {
      route: 'US → Hong Kong (Business)', detail: 'Cathay Pacific Business via Alaska MileagePlan',
      ptsNeeded: '50,000', estCash: '$5,000+', cpp: '10.0¢',
      cards: ['Amex MR', 'Chase UR', 'Cap1 Miles'], programs: ['Alaska MileagePlan'], category: 'flight',
      note: 'Alaska MileagePlan prices Cathay Pacific Business from the US West Coast to HKG at only 50K miles one-way. No fuel surcharges. Book via alaska.com with Cathay availability.',
      isNew: true,
    },
    {
      route: 'US → Tokyo (First)', detail: 'JAL First Class via American AAdvantage',
      ptsNeeded: '60,000', estCash: '$10,000+', cpp: '16.7¢',
      cards: ['Bilt'], programs: ['American AAdvantage'], category: 'flight',
      note: 'JAL First Class is one of the most sought-after products in the sky. AAdvantage prices it at 60K one-way from the US West Coast. Release is very limited — search up to 11 months out.',
      isNew: true,
    },
    {
      route: 'US → Taipei / SE Asia (Business)', detail: 'EVA Royal Laureate via Air Canada Aeroplan',
      ptsNeeded: '55,000', estCash: '$5,500+', cpp: '10.0¢',
      cards: ['Amex MR', 'Chase UR', 'Cap1 Miles', 'Bilt'], programs: ['Air Canada Aeroplan'], category: 'flight',
      note: 'EVA\'s Royal Laureate Business is a hidden gem — lie-flat seats with excellent service and great availability. Aeroplan prices it without fuel surcharges at 55K from North America.',
      isNew: true,
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
    {
      from: 'Capital One', fromId: 'cap1_miles',
      to: 'Turkish Miles&Smiles', toIcon: '🌙',
      bonus: '20% bonus', expires: '2026-06-01',
      note: 'Capital One → Turkish bonus pairs perfectly with Star Alliance Business Class sweet spots.',
    },
    {
      from: 'Amex MR', fromId: 'amex_mr',
      to: 'Air Canada Aeroplan', toIcon: '🍁',
      bonus: '25% bonus', expires: '2026-08-31',
      note: 'Aeroplan is the most flexible Star Alliance program. This bonus gives extra leverage on every redemption.',
    },
    {
      from: 'Chase UR', fromId: 'chase_ur',
      to: 'World of Hyatt', toIcon: '🏨',
      bonus: '25% bonus', expires: '2026-07-31',
      note: 'Chase → Hyatt bonus boosts your hotel redemption value. Great timing before summer travel season.',
    },
    {
      from: 'Bilt', fromId: 'bilt',
      to: 'Air Canada Aeroplan', toIcon: '🍁',
      bonus: '20% bonus', expires: '2026-09-15',
      note: 'Bilt → Aeroplan bonus adds extra value on top of Aeroplan\'s already partner-rich award chart.',
    },
    {
      from: 'Citi TY', fromId: 'citi_ty',
      to: 'Air France/KLM Flying Blue', toIcon: '🇫🇷',
      bonus: '20% bonus', expires: '2026-06-15',
      note: 'Citi ThankYou → Flying Blue bonus pairs perfectly with Flying Blue Promo Awards for maximum value.',
    },
  ];
}

import { Injectable } from '@angular/core';
import { CreditCard, Recommendation, SweetSpot } from '../models';

@Injectable({ providedIn: 'root' })
export class DataService {

  readonly cards: CreditCard[] = [
    {
      id: 'amex_mr', name: 'Amex Membership Rewards', short: 'Amex MR',
      icon: '💙', color: '#006FCF', textColor: '#fff',
      cards: ['Amex Platinum', 'Amex Gold', 'Amex Green', 'Blue Business Plus'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air Canada Aeroplan',       icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'British Airways Avios',     icon: '🇬🇧', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'Air France/KLM Flying Blue',icon: '🇫🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'Singapore KrisFlyer',       icon: '🦁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.2 },
        { name: 'ANA Mileage Club',          icon: '🎌', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.4 },
        { name: 'Virgin Atlantic Flying Club',icon: '✈', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.1 },
        { name: 'Delta SkyMiles',            icon: '△',  ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.2 },
        { name: 'Hilton Honors',             icon: '🟡', ratio: '1:2', type: 'hotel',   quality: 'good',  cpp: 0.5 },
        { name: 'Marriott Bonvoy',           icon: '🔴', ratio: '1:3', type: 'hotel',   quality: 'good',  cpp: 0.8 },
      ]
    },
    {
      id: 'chase_ur', name: 'Chase Ultimate Rewards', short: 'Chase UR',
      icon: '🔵', color: '#117ACA', textColor: '#fff',
      cards: ['Sapphire Reserve', 'Sapphire Preferred', 'Ink Business Preferred'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air Canada Aeroplan',       icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'British Airways Avios',     icon: '🇬🇧', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'United MileagePlus',        icon: '🌐', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.5 },
        { name: 'Air France/KLM Flying Blue',icon: '🇫🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'Virgin Atlantic Flying Club',icon: '✈', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.1 },
        { name: 'Singapore KrisFlyer',       icon: '🦁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.2 },
        { name: 'Southwest Rapid Rewards',   icon: '❤️', ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.5 },
        { name: 'World of Hyatt',            icon: '🟤', ratio: '1:1', type: 'hotel',   quality: 'great', cpp: 2.0 },
        { name: 'IHG One Rewards',           icon: '🟠', ratio: '1:1', type: 'hotel',   quality: 'good',  cpp: 0.7 },
        { name: 'Marriott Bonvoy',           icon: '🔴', ratio: '1:1', type: 'hotel',   quality: 'good',  cpp: 0.8 },
      ]
    },
    {
      id: 'citi_ty', name: 'Citi ThankYou Points', short: 'Citi TY',
      icon: '🟣', color: '#003B70', textColor: '#fff',
      cards: ['Citi Strata Premier', 'Citi Prestige', 'Citi Double Cash'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air France/KLM Flying Blue',icon: '🇫🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'Virgin Atlantic Flying Club',icon: '✈', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.1 },
        { name: 'Singapore KrisFlyer',       icon: '🦁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.2 },
        { name: 'Turkish Miles&Smiles',      icon: '🌙', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.3 },
        { name: 'Air Canada Aeroplan',       icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'Avianca LifeMiles',         icon: '🦅', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.6 },
        { name: 'JetBlue TrueBlue',         icon: '🔷', ratio: '1:1', type: 'airline', quality: 'good',  cpp: 1.3 },
        { name: 'Wyndham Rewards',          icon: '🔶', ratio: '1:1', type: 'hotel',   quality: 'good',  cpp: 1.0 },
      ]
    },
    {
      id: 'cap1_miles', name: 'Capital One Miles', short: 'Cap1',
      icon: '🔺', color: '#D03027', textColor: '#fff',
      cards: ['Venture X', 'Venture', 'Spark Miles'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air Canada Aeroplan',       icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'British Airways Avios',     icon: '🇬🇧', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.0 },
        { name: 'Air France/KLM Flying Blue',icon: '🇫🇷', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'Turkish Miles&Smiles',      icon: '🌙', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.3 },
        { name: 'Singapore KrisFlyer',       icon: '🦁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 2.2 },
        { name: 'Avianca LifeMiles',         icon: '🦅', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.6 },
        { name: 'Wyndham Rewards',          icon: '🔶', ratio: '2:3', type: 'hotel',   quality: 'good',  cpp: 1.0 },
      ]
    },
    {
      id: 'bilt', name: 'Bilt Rewards', short: 'Bilt',
      icon: '🏠', color: '#1a1a1a', textColor: '#fff',
      cards: ['Bilt Mastercard'],
      baseCpp: 1.0,
      partners: [
        { name: 'Air Canada Aeroplan',       icon: '🍁', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'American AAdvantage',       icon: '🦅', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.7 },
        { name: 'United MileagePlus',        icon: '🌐', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.5 },
        { name: 'Alaska MileagePlan',        icon: '❄️', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 },
        { name: 'Emirates Skywards',         icon: '✨', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.4 },
        { name: 'World of Hyatt',            icon: '🟤', ratio: '1:1', type: 'hotel',   quality: 'great', cpp: 2.0 },
        { name: 'IHG One Rewards',           icon: '🟠', ratio: '1:3', type: 'hotel',   quality: 'good',  cpp: 0.7 },
        { name: 'Marriott Bonvoy',           icon: '🔴', ratio: '1:3', type: 'hotel',   quality: 'good',  cpp: 0.8 },
      ]
    }
  ];

  readonly flightRecs: Record<string, Recommendation[]> = {
    transatlantic: [
      { program: 'Virgin Atlantic Flying Club', partner: 'via Delta/Air France/ANA', cpp: 2.1, ptsBase: 50000, cards: ['amex_mr','chase_ur','citi_ty'], note: 'Upper class from 50K pts' },
      { program: 'Air France Flying Blue',      partner: 'on Air France/KLM',         cpp: 1.9, ptsBase: 55000, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Promo awards drop monthly' },
      { program: 'British Airways Avios',       partner: 'on BA/AA/Iberia',            cpp: 1.8, ptsBase: 57500, cards: ['amex_mr','chase_ur','cap1_miles'], note: 'Distance-based — great for short hops' },
      { program: 'ANA Mileage Club',            partner: 'on United/Lufthansa',        cpp: 2.4, ptsBase: 88000, cards: ['amex_mr'], note: 'Best value in Business round-trip' },
    ],
    transpacific: [
      { program: 'ANA Mileage Club',            partner: 'on ANA/United',              cpp: 2.4, ptsBase: 88000, cards: ['amex_mr'], note: 'Best for Japan routes' },
      { program: 'Air Canada Aeroplan',         partner: 'on Star Alliance',            cpp: 2.0, ptsBase: 75000, cards: ['amex_mr','chase_ur','cap1_miles','bilt'], note: 'No fuel surcharges on many partners' },
      { program: 'Singapore KrisFlyer',         partner: 'on Singapore/Star Alliance',  cpp: 2.2, ptsBase: 89000, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Suites class — unmatched experience' },
      { program: 'Virgin Atlantic Flying Club', partner: 'on ANA',                      cpp: 2.5, ptsBase: 60000, cards: ['amex_mr','chase_ur','citi_ty'], note: 'ANA First via Virgin — huge sweet spot' },
    ],
    domestic: [
      { program: 'Alaska MileagePlan',    partner: 'on Alaska/AA/BA',           cpp: 1.8, ptsBase: 12500, cards: ['bilt'], note: 'Best domestic saver awards' },
      { program: 'Air Canada Aeroplan',   partner: 'on United (nearside US)',    cpp: 1.7, ptsBase: 12500, cards: ['amex_mr','chase_ur','cap1_miles'], note: 'Great for short United hops' },
      { program: 'Southwest Rapid Rewards',partner: 'on Southwest',             cpp: 1.5, ptsBase: 12000, cards: ['chase_ur'], note: 'Great Companion Pass strategy' },
      { program: 'American AAdvantage',   partner: 'on AA domestic',             cpp: 1.5, ptsBase: 12500, cards: ['bilt'], note: 'Web specials go low' },
    ],
    default: [
      { program: 'Air Canada Aeroplan',         partner: 'on Star Alliance worldwide',  cpp: 1.8, ptsBase: 35000, cards: ['amex_mr','chase_ur','cap1_miles','bilt'], note: 'Most flexible, no fuel surcharges' },
      { program: 'Turkish Miles&Smiles',        partner: 'on Star Alliance',            cpp: 2.3, ptsBase: 45000, cards: ['citi_ty','cap1_miles'], note: 'Incredible Business pricing' },
      { program: 'Singapore KrisFlyer',         partner: 'on Singapore/partners',       cpp: 2.2, ptsBase: 62500, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Best First Class value' },
      { program: 'Virgin Atlantic Flying Club', partner: 'on Delta/ANA/Air France',     cpp: 2.1, ptsBase: 50000, cards: ['amex_mr','chase_ur','citi_ty'], note: 'Widely transferable' },
      { program: 'Air France Flying Blue',      partner: 'on Air France/KLM',           cpp: 1.9, ptsBase: 50000, cards: ['amex_mr','chase_ur','citi_ty','cap1_miles'], note: 'Monthly promos — watch for deals' },
    ]
  };

  readonly hotelRecs: Record<string, Recommendation[]> = {
    luxury: [
      { program: 'World of Hyatt',   partner: 'Park Hyatt / Alila / Andaz',          cpp: 2.1, ptsBase: 30000, cards: ['chase_ur','bilt'], note: 'Best CPP of any hotel program' },
      { program: 'IHG One Rewards',  partner: 'InterContinental / Kimpton',           cpp: 0.8, ptsBase: 70000, cards: ['chase_ur'], note: 'Combine with annual free night cert' },
    ],
    mid: [
      { program: 'World of Hyatt',   partner: 'Hyatt Place / Hyatt House',            cpp: 2.0, ptsBase: 15000, cards: ['chase_ur','bilt'], note: 'Category 4 properties sweet spot' },
      { program: 'Marriott Bonvoy',  partner: 'Westin / Sheraton / JW',               cpp: 0.9, ptsBase: 35000, cards: ['amex_mr','chase_ur','bilt'], note: 'Off-peak pricing helps value' },
    ],
    budget: [
      { program: 'Wyndham Rewards',  partner: 'La Quinta / Travelodge',               cpp: 1.1, ptsBase: 7500,  cards: ['citi_ty','cap1_miles'], note: 'Consistent value in budget tiers' },
      { program: 'Hilton Honors',    partner: 'Hampton / Hilton Garden Inn',           cpp: 0.6, ptsBase: 30000, cards: ['amex_mr'], note: 'Use 5th night free benefit' },
    ],
    top: [
      { program: 'World of Hyatt',   partner: 'Park Hyatt Tokyo / Maldives',          cpp: 2.4, ptsBase: 45000, cards: ['chase_ur','bilt'], note: 'Cat 7–8 worth $800+/night' },
      { program: 'Marriott Bonvoy',  partner: 'St. Regis / Ritz-Carlton',             cpp: 1.0, ptsBase: 85000, cards: ['amex_mr','chase_ur','bilt'], note: '5th night free on 5-night redemption' },
    ],
    default: [
      { program: 'World of Hyatt',   partner: 'Hyatt portfolio worldwide',            cpp: 2.0, ptsBase: 25000, cards: ['chase_ur','bilt'], note: 'Highest consistent value in hotels' },
      { program: 'Marriott Bonvoy',  partner: 'Marriott / Westin / Sheraton',         cpp: 0.9, ptsBase: 45000, cards: ['amex_mr','chase_ur','bilt'], note: 'Largest portfolio' },
      { program: 'Hilton Honors',    partner: 'Conrad / Waldorf Astoria',             cpp: 0.6, ptsBase: 95000, cards: ['amex_mr'], note: 'Watch for 5th night free' },
    ]
  };

  readonly sweetSpots: SweetSpot[] = [
    {
      route: 'US → Japan (Business)', detail: 'ANA Business Class roundtrip via Star Alliance',
      ptsNeeded: '88,000', estCash: '$5,000+', cpp: '5.7¢',
      cards: ['Amex MR'], programs: ['ANA Mileage Club'],
      note: 'Best Business Class deal in points. No fuel surcharges. Book 355 days out.'
    },
    {
      route: 'US → Europe (Business)', detail: 'Virgin Atlantic to fly Delta One / Air France',
      ptsNeeded: '50,000', estCash: '$4,000+', cpp: '8.0¢',
      cards: ['Amex MR', 'Chase UR', 'Citi TY'], programs: ['Virgin Atlantic Flying Club'],
      note: 'One of the most consistent transatlantic sweet spots. Transfer on demand.'
    },
    {
      route: 'US → Japan (First)', detail: 'ANA First Class via Virgin Atlantic transfer',
      ptsNeeded: '60,000', estCash: '$15,000+', cpp: '25¢',
      cards: ['Amex MR', 'Chase UR', 'Citi TY'], programs: ['Virgin Atlantic Flying Club'],
      note: 'The holy grail. Virgin charges just 60K for ANA First one-way. Availability is extremely limited.'
    },
    {
      route: 'US Short Haul', detail: 'Alaska Saver Awards on American Airlines',
      ptsNeeded: '12,500', estCash: '$250–400', cpp: '2.4¢',
      cards: ['Bilt'], programs: ['Alaska MileagePlan'],
      note: 'Only Bilt transfers to Alaska. Saver space on AA can be easier to find than on AAdvantage.'
    },
    {
      route: 'Park Hyatt Tokyo', detail: '5-night stay at one of the world\'s best hotels',
      ptsNeeded: '225,000', estCash: '$5,000+', cpp: '2.2¢',
      cards: ['Chase UR', 'Bilt'], programs: ['World of Hyatt'],
      note: 'Cat 7. Book at exactly 13 months for best availability.'
    },
    {
      route: 'Turkish Business Class', detail: 'Istanbul and beyond via Miles&Smiles',
      ptsNeeded: '45,000', estCash: '$3,500+', cpp: '7.7¢',
      cards: ['Citi TY', 'Cap1 Miles'], programs: ['Turkish Miles&Smiles'],
      note: 'Incredible pricing for Star Alliance Business. Online awards only at turkish.com.'
    },
    {
      route: 'Flying Blue Promo Awards', detail: 'Monthly flash sales — Air France / KLM routes',
      ptsNeeded: 'Varies (30–50% off)', estCash: 'Varies', cpp: '2.0¢+',
      cards: ['Amex MR', 'Chase UR', 'Citi TY', 'Cap1'], programs: ['Air France/KLM Flying Blue'],
      note: 'Every month Flying Blue publishes Promo Awards. Set alerts — deals disappear fast.'
    },
    {
      route: 'Hyatt Category 1–4', detail: 'Mid-range Hyatts: reliable CPP floor',
      ptsNeeded: '5,000–15,000/night', estCash: '$150–400/night', cpp: '2.0¢+',
      cards: ['Chase UR', 'Bilt'], programs: ['World of Hyatt'],
      note: 'Even "boring" Hyatt properties deliver 2¢+ reliably. Stash Chase UR exclusively for Hyatt.'
    },
  ];
}

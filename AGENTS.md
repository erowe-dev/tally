# AGENTS.md — Tally Points Advisor

## Project Overview
Tally is a mobile-first PWA that helps intermediate credit card points earners optimize transfer decisions for flights and hotel redemptions. Built with Angular 18, deployed to Vercel via GitHub (`erowe-dev/tally`, auto-deploys on push to `main`).

**This is NOT part of the Charleston Homes (CHO) codebase. Never mix CHO references, patterns, or imports into this project.**

---

## Tech Stack
- **Framework:** Angular 18, standalone components (no NgModules anywhere)
- **State:** Angular Signals (`signal()`, `computed()`) — prefer over RxJS/BehaviorSubject
- **Styling:** Component-scoped SCSS + global CSS custom properties in `src/styles.scss`
- **Persistence:** `localStorage` (no backend yet)
- **PWA:** `@angular/service-worker` + `ngsw-config.json`
- **Deployment:** Vercel (auto-deploy on push to `main`)
- **Future backend:** .NET 8 Web API on Azure App Service
- **Future auth:** Microsoft Entra External ID
- **Future payments:** Stripe

---

## Repository Structure
```
src/app/
├── core/
│   ├── models/index.ts              # All TypeScript interfaces
│   └── services/
│       ├── data.service.ts          # Static card/partner/recommendation data
│       ├── wallet.service.ts        # Balance tracking — signals + localStorage
│       ├── optimizer.service.ts     # Route detection + transfer recommendations
│       └── expiry.service.ts        # Per-program expiry rules engine
├── features/
│   ├── optimizer/                   # Transfer optimizer tab
│   ├── wallet/                      # Points wallet tab
│   ├── cards/                       # Cards & partners reference tab
│   ├── sweetspots/                  # Curated sweet spots tab
│   └── expiry/                      # Points expiry tracker tab
└── shared/components/
    ├── tally-logo/                  # Logo component (size + showText inputs)
    └── bottom-nav/                  # Bottom nav with expiry badge
landing/index.html                   # Standalone waitlist landing page (static HTML)
n8n/                                 # n8n workflow JSONs
scripts/generate-icons.mjs           # PWA icon generator
public/manifest.webmanifest          # PWA manifest
ngsw-config.json                     # Service worker cache config
```

---

## Coding Rules

### Angular patterns
- **Always use standalone components** — never add NgModule declarations
- **Always use `inject()`** in components instead of constructor injection where possible
- **State = Signals** — use `signal()`, `computed()`, `effect()`. Only use RxJS when Angular requires it (e.g. router events, HTTP)
- **CSS is component-scoped** — put styles in the component's `styles` array, not in global scss files
- **Global tokens only** in `src/styles.scss` — CSS custom properties, no utility classes

### File conventions
- One component per file, filename matches selector (e.g. `optimizer.component.ts`)
- Services are `providedIn: 'root'` — no lazy-loaded providers yet
- All interfaces live in `src/app/core/models/index.ts`

### Data
- All static data (cards, partners, recommendations, sweet spots, expiry rules) lives in the relevant service file — not hardcoded in components
- `localStorage` keys are namespaced and versioned: `tally_wallet_v1`, `tally_expiry_v1`
- Always wrap `localStorage` calls in try/catch

---

## Brand Tokens (never override these in components)
```
--tally-green:       #1a7a4a   → Primary CTA, positive values, active nav
--tally-green-light: #e8f5ee   → Backgrounds, badges, highlights
--tally-green-mid:   #2d9e62   → Hover states, chart bars, CPP labels
--tally-amber:       #b45309   → Warnings, expiry alerts
--tally-red:         #dc2626   → Critical / expired states
--off:               #f7f6f3   → App background
--surface:           #f0efe9   → Card inner backgrounds
--border:            #e4e2db   → Default borders
--text:              #1a1916   → Primary text
--text2:             #5c5a54   → Secondary text
--text3:             #9b9890   → Labels, placeholders, tertiary
```
Fonts:
- Display: `'Instrument Serif'` — headlines, section titles, logo wordmark
- UI/Body: `'Geist'` — all interactive elements, body copy
- Data: `'Geist Mono'` — numbers, CPP values, labels, badges

---

## Adding Data

### New credit card program
Add to the `cards` array in `src/app/core/services/data.service.ts`:
```typescript
{
  id: 'unique_id',
  name: 'Full Program Name',
  short: 'Short Label',        // used in chips/badges
  icon: '🔷',
  color: '#hexcolor',
  textColor: '#fff',
  cards: ['Card Name 1', 'Card Name 2'],
  baseCpp: 1.0,
  partners: [
    {
      name: 'Airline or Hotel Name',
      icon: '✈',
      ratio: '1:1',
      type: 'airline',         // 'airline' | 'hotel'
      quality: 'great',        // 'great' | 'good'
      cpp: 1.8
    }
  ]
}
```

### New flight/hotel recommendation set
Add to `flightRecs` or `hotelRecs` in `data.service.ts`. Keys match route categories: `transatlantic`, `transpacific`, `domestic`, `default` for flights; `budget`, `mid`, `luxury`, `top`, `default` for hotels.

### New sweet spot
Add to the `sweetSpots` array in `data.service.ts`.

### New expiry rule
Add to `EXPIRY_RULES` in `src/app/core/services/expiry.service.ts`. Types are `'activity'`, `'fixed'`, or `'never'`.

---

## Deploy Flow
```bash
ng build --configuration production   # verify clean build first
git add .
git commit -m "feat: your change"
git push origin main                  # Vercel auto-deploys in ~30s
```

Always run `ng build` before pushing — the production build catches template errors that `ng serve` misses.

---

## Known Build Notes
- `@angular/service-worker` must stay at version 18.x to match Angular core
- Google Fonts must be loaded via `<link>` in `index.html`, NOT `@import` in SCSS (causes build-time 403)
- Font inlining is disabled in `angular.json` (`optimization.fonts: false`)
- Component style budget warnings are expected for `optimizer` and `expiry` components — ignore them

---

## Not Implemented Yet (next priorities)
1. Wire `landing/index.html` waitlist form to n8n webhook (`submitEmail()` currently logs to console)
2. Generate PWA icons: `npm install --save-dev canvas && npm run icons`
3. Auth — Microsoft Entra External ID
4. Cloud sync — .NET 8 API + Azure App Service
5. Saved trips feature
6. Stripe billing (`$6.99/mo` or `$49/yr`)
7. Seats.aero API for live award availability
8. Web push notifications for expiry alerts + Flying Blue promos

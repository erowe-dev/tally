# Tally — Points Advisor

> Know exactly what to do with your points.

A mobile-first Progressive Web App (PWA) for intermediate credit card points earners. Built with Angular 18, standalone components, signals, Auth0, and an Express API.

---

## Quick Start

```bash
npm install
ng serve
# → http://localhost:4200
```

### Build & deploy PWA
```bash
npm run build:pwa          # → dist/tally/browser/
npm run serve:pwa          # → http://localhost:8080 (test PWA locally)
```

### Generate icons
```bash
npm install --save-dev canvas
npm run icons              # → public/icons/icon-{size}x{size}.png
```
Or upload `public/tally-icon.svg` to https://progressier.com/pwa-icons-generator.

---

## Project Structure

```
tally/
├── src/app/
│   ├── core/
│   │   ├── models/index.ts           ← All TypeScript interfaces
│   │   └── services/
│   │       ├── data.service.ts       ← Static card/partner/rec data
│   │       ├── wallet.service.ts     ← Balances (signals + localStorage)
│   │       ├── optimizer.service.ts  ← Route detection + recommendations
│   │       └── expiry.service.ts     ← Points expiry rules engine
│   ├── features/
│   │   ├── optimizer/                ← Transfer optimizer tab
│   │   ├── wallet/                   ← Points wallet tab
│   │   ├── cards/                    ← Cards & partners tab
│   │   ├── sweetspots/               ← Sweet spots tab
│   │   └── expiry/                   ← Expiry tracker tab
│   └── shared/components/
│       ├── tally-logo/               ← Logo (size + text variants)
│       └── bottom-nav/               ← Bottom nav w/ expiry badge
│
├── landing/
│   └── index.html                    ← Standalone waitlist landing page
│
├── n8n/
│   ├── flying-blue-alert.json        ← Monthly Flying Blue promo scraper
│   └── waitlist-webhook.json         ← Waitlist signup → Sheet + email
│
├── scripts/
│   └── generate-icons.mjs            ← PWA icon generator (all sizes)
│
├── public/
│   ├── manifest.webmanifest          ← PWA manifest
│   └── tally-icon.svg                ← Icon source
│
└── ngsw-config.json                  ← Service worker caching config
```

---

## Brand Tokens

Defined in `src/styles.scss`, used everywhere via CSS custom properties:

| Token | Value | Usage |
|-------|-------|-------|
| `--tally-green` | `#1a7a4a` | Primary, CTAs, positive |
| `--tally-green-light` | `#e8f5ee` | Backgrounds, badges |
| `--tally-amber` | `#b45309` | Warnings, expiry alerts |
| `--tally-red` | `#dc2626` | Critical / expired |
| `--off` | `#f7f6f3` | App background |
| `--text` | `#1a1916` | Primary text |

**Fonts:** `Instrument Serif` (display) + `Geist` (UI) + `Geist Mono` (data/labels)

---

## Adding Data

All data lives in `src/app/core/services/data.service.ts`.

**New card program:**
```typescript
{
  id: 'program_id',
  name: 'Full Name', short: 'Short',
  icon: '🔷', color: '#hex', textColor: '#fff',
  cards: ['Card 1', 'Card 2'],
  baseCpp: 1.0,
  partners: [
    { name: 'Airline', icon: '✈', ratio: '1:1', type: 'airline', quality: 'great', cpp: 1.8 }
  ]
}
```

**New sweet spot:** Add to `sweetSpots` array in `data.service.ts`.

**New expiry rule:** Add to `EXPIRY_RULES` in `expiry.service.ts`.

---

## n8n Workflows

### Flying Blue Promo Alert (`n8n/flying-blue-alert.json`)
- Runs daily 8am during first 7 days of each month
- Scrapes Flying Blue promo page, detects if awards are live
- Sends alert email (once per month max, deduped via Redis)
- **Setup:** Import JSON → set SMTP credentials → set `ALERT_EMAIL` env var

### Waitlist Webhook (`n8n/waitlist-webhook.json`)
- Landing page posts to `https://tally-api-theta.vercel.app/api/waitlist`
- API proxies to the n8n `WAITLIST_WEBHOOK_URL`
- Validates email → Google Sheet → confirmation email → builder ping
- **Setup:** Import JSON → set Google Sheets credentials → set `YOUR_EMAIL` env var
- **Landing page:** Shows a `mailto:hello@tallypoints.app` fallback only when the API/webhook is unavailable

---

## Deploying the Landing Page

The landing page is a single static HTML file — deploy anywhere:

```bash
# Vercel
vercel deploy landing/

# Netlify
netlify deploy --dir=landing/

# Azure Static Web Apps (matches your CHO stack)
# Add landing/ to your Static Web App source
```

Point `tallypoints.app` (or your domain) at it.

---

## Production Checks

Run local production preflight before pushing a release:

```bash
npm run preflight:prod
npm run verify
```

After Vercel deploys, run:

```bash
npm run smoke:prod
```

For a personal signed-in API smoke, provide an Auth0 access token and email:

```powershell
$env:TALLY_AUTH_TOKEN="<Auth0 access token for https://api.tally.app>"
$env:TALLY_AUTH_EMAIL="<your Auth0 email>"
npm run smoke:auth
```

Production API responses include `X-Request-Id`; use that value to correlate browser failures with Vercel function logs.

Wallet and Expiry API reads also keep a one-hour localStorage read-through cache (`tally_cache_balances`, `tally_cache_expiry`) so first authenticated loads can fall back cleanly if the cross-origin API is temporarily unavailable.

---

## Roadmap

### ✅ Done
- Transfer optimizer (flight + hotel, route detection, CPP ranking)
- Points wallet with localStorage persistence
- Cards & partners reference
- Sweet spots library (8 curated redemptions)
- Points expiry tracker with urgency levels
- PWA (manifest, service worker, iOS/Android installable)
- Tally brand system
- Landing page + waitlist form
- n8n workflows (Flying Blue alert + waitlist handler)
- Deferred tab loading — app shell ships first, feature tabs load on demand

### 🔨 Pre-launch
- [x] Generate actual icon PNGs (`npm run icons`)
- [x] Wire landing page form to API-backed n8n webhook proxy
- [ ] Deploy landing page → grab domain
- [ ] Import n8n workflows and configure credentials

### 🚀 Alpha Pro Tier
- [x] Auth — Auth0 SPA
- [x] Cloud sync — wallet, expiry, and saved trips across devices
- [x] Saved trips feature
- [x] Analytics event call sites — provider endpoint disabled until configured
- [x] Optimizer → Sweet Spots deep link
- [x] HOW_TO_BOOK coverage for Avianca, Aeroplan, Korean Air, and Aeromexico
- [ ] Push notifications (web push API)
- [ ] Stripe billing — $6.99/mo or $49/year
- [ ] Seats.aero API integration for live award search
- [ ] Couple/partner combined wallet mode

---

## Notes for AI Coding Agents

- **Not** part of Charleston Homes (CHO) — completely separate project
- All components are **standalone** — no NgModules
- State uses **Angular Signals** — prefer `signal()` / `computed()` over RxJS where possible
- CSS is **component-scoped** — global tokens only in `src/styles.scss`
- `localStorage` keys: `tally_wallet_v1`, `tally_expiry_v1`
- Backend target: Express API on Vercel Functions
- Auth target: Auth0
- Payments target: Stripe

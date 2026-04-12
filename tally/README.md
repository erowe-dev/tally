# Tally — Points Advisor

> Know exactly what to do with your points.

A mobile-first Progressive Web App (PWA) for intermediate credit card points earners. Built with Angular 18, standalone components, and signals.

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
- POST `/webhook/tally-waitlist` from landing page form
- Validates email → Google Sheet → confirmation email → builder ping
- **Setup:** Import JSON → set Google Sheets credentials → set `YOUR_EMAIL` env var
- **Landing page:** Update the `fetch()` URL in `landing/index.html` with your n8n webhook URL

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

### 🔨 Pre-launch
- [ ] Generate actual icon PNGs (`npm run icons`)
- [ ] Wire landing page form to n8n webhook URL
- [ ] Deploy landing page → grab domain
- [ ] Import n8n workflows and configure credentials

### 🚀 Alpha Pro Tier
- [ ] Auth — Microsoft Entra External ID
- [ ] Cloud sync — wallet + saved trips across devices
- [ ] Saved trips feature
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
- Backend target: `.NET 8 Web API` on Azure App Service
- Auth target: Microsoft Entra External ID
- Payments target: Stripe

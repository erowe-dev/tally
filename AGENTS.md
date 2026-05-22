# AGENTS.md — Tally Points Advisor

## Project Overview
Tally is a mobile-first PWA that helps intermediate credit card points earners optimize transfer decisions for flights and hotel redemptions. Built with Angular 18 + Auth0 + Express API + Supabase PostgreSQL. Deployed to Vercel for both the Angular app and API via GitHub (`erowe-dev/tally`, auto-deploys on push to `main`).

**This is NOT part of any other codebase. Never mix references, patterns, or imports from other projects.**

---

## Tech Stack
- **Framework:** Angular 18, standalone components (no NgModules anywhere)
- **State:** Angular Signals (`signal()`, `computed()`, `effect()`) — prefer over RxJS/BehaviorSubject
- **Auth:** Auth0 SPA (`@auth0/auth0-angular`), domain `dev-2iqdjh6lgnv6pnz5.us.auth0.com`
- **API:** Express + TypeScript in `api/` — deployed on Vercel Functions
- **Database:** Supabase (PostgreSQL) + Prisma ORM
- **Persistence:** `localStorage` write-through cache; API is source of truth on load
- **PWA:** `manifest.webmanifest` in `src/`, wired to `angular.json` assets
- **Styling:** Component-scoped SCSS + global CSS custom properties in `src/styles.scss`
- **Dark mode:** Automatic via `@media (prefers-color-scheme: dark)` in `styles.scss`
- **Angular deploy:** Vercel (auto-deploy on push to `main`, root dir = `tally/`)
- **API deploy:** Vercel Functions (root dir = `api/`)

---

## Repository Structure
```
tally/                                   ← Angular app (Vercel root dir)
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── models/index.ts              # All TypeScript interfaces + NavTab type
│   │   │   └── services/
│   │   │       ├── auth.service.ts          # Auth0 wrapper: signals + provisioning + retry
│   │   │       ├── api.service.ts           # Authenticated HTTP client (balances, expiry, trips)
│   │   │       ├── network.service.ts       # Online/offline signal (window events)
│   │   │       ├── data.service.ts          # Static card/partner/recommendation/bonus data
│   │   │       ├── wallet.service.ts        # Balance tracking — signals + localStorage + API sync
│   │   │       ├── optimizer.service.ts     # Route detection + transfer recommendations
│   │   │       ├── expiry.service.ts        # Per-program expiry rules engine + API sync
│   │   │       └── trips.service.ts         # Saved trips — optimistic UI + API sync
│   │   ├── features/
│   │   │   ├── optimizer/                   # Transfer optimizer tab (protected)
│   │   │   ├── wallet/                      # Points wallet tab (protected)
│   │   │   ├── cards/                       # Cards & partners reference tab (public)
│   │   │   ├── sweetspots/                  # Curated sweet spots + transfer bonuses (public)
│   │   │   └── expiry/                      # Points expiry tracker tab (protected)
│   │   └── shared/components/
│   │       ├── tally-logo/                  # Logo component (size + showText inputs)
│   │       └── bottom-nav/                  # Bottom nav with expiry badge + lock dots
│   ├── environments/
│   │   ├── environment.ts                   # Dev: localhost API + Auth0 dev app
│   │   └── environment.production.ts        # Prod: Vercel API URL + same Auth0 app
│   ├── styles.scss                          # Global CSS tokens + dark mode palette
│   ├── index.html                           # PWA meta tags, fonts, manifest link
│   └── manifest.webmanifest                 # PWA manifest (icons, shortcuts)
api/                                     ← Express API (Vercel API root dir)
├── src/
│   ├── index.ts                         # Express entry: CORS, routes, env validation
│   ├── lib/
│   │   ├── prisma.ts                    # Singleton PrismaClient (pooled URL)
│   │   ├── env.ts                       # Startup env var validation (fails fast)
│   │   └── route-helpers.ts             # requireUser(), validateCardId(), asyncRoute()
│   ├── middleware/auth.ts               # Auth0 JWT validation (JWKS/RS256)
│   └── routes/
│       ├── users.ts                     # POST /api/users/me (upsert on auth0Id)
│       ├── balances.ts                  # GET/PUT /api/balances/:cardId
│       ├── expiry.ts                    # GET/PUT/DELETE /api/expiry/:cardId
│       └── trips.ts                     # GET/POST/DELETE /api/trips
└── prisma/schema.prisma                 # User, Balance, ExpiryRecord, Trip models
```

---

## Coding Rules

### Angular patterns
- **Always use standalone components** — never add NgModule declarations
- **Always use `inject()`** — no constructor injection (even in services)
- **State = Signals** — use `signal()`, `computed()`, `effect()`. RxJS is only in `auth.service.ts`
- **CSS is component-scoped** — put styles in the component's `styles` array
- **Global tokens only** in `src/styles.scss` — CSS custom properties, no utility classes

### Auth gating
- Protected tabs: `optimizer`, `wallet`, `expiry` — gated via `AppComponent.handleTabChange()`
- Public tabs: `cards`, `sweetspots` — always rendered
- Auth state: `auth.isAuthenticated()`, `auth.isResolved()`, `auth.isProvisioned()`
- **Always gate API calls on `auth.isProvisioned()`** not just `isAuthenticated()` — prevents 404 race with POST /api/users/me

### API sync pattern (wallet / expiry / trips)
```
1. On login: effect() fires when isResolved() && isAuthenticated() && isProvisioned() && isOnline()
2. GET /api/{resource} → balances/expiry use a 1h localStorage read-through cache for API failures
3. If API empty + local has data → push local up; else API overwrites local
4. Writes: update signal + localStorage immediately, then fire-and-forget API call
5. Error: reset _apiLoaded=false so retry happens when network comes back (isOnline() re-fires effect)
6. Optimistic trips: insert local with temp id, replace with real id on API success
```

### File conventions
- One component per file, filename matches selector
- Services are `providedIn: 'root'`
- All interfaces in `src/app/core/models/index.ts`

### Data (all static, lives in `data.service.ts`)
- `cards: CreditCard[]` — 14 programs (5 transferable, 5 airline, 4 hotel)
- `flightRecs: Record<string, Recommendation[]>` — 9 route categories (transatlantic, transpacific, domestic, latin_america, caribbean, middle_east, africa, eurasia, default)
- `hotelRecs: Record<string, Recommendation[]>` — 5 hotel tiers (budget, mid, luxury, top, default)
- `sweetSpots: SweetSpot[]` — 16 curated sweet spots with category filter
- `transferBonuses: TransferBonus[]` — active time-limited transfer bonus promos (manually updated)
- `localStorage` keys: `tally_wallet_v1`, `tally_expiry_v1`, `tally_trips_v1`
- API read-through cache keys: `tally_cache_balances`, `tally_cache_expiry`
- Always wrap `localStorage` in try/catch

---

## Feature Summary (implemented)

### Tabs
| Tab | Auth | Description |
|---|---|---|
| Optimizer | Protected | Flight/hotel transfer optimizer with 9 route categories, wallet coverage bars, estimated $ value, saved trips |
| Wallet | Protected | Balance entry grouped by category (Transferable/Airline/Hotel), quick-add buttons, per-row $ value, goal tracker |
| Cards | Public | Partner programs with full-text search, category filter, "Great only" toggle |
| Spots | Public | 16 curated sweet spots with category filter + active transfer bonus strip |
| Expiry | Protected | Per-program expiry rules engine, urgency sorting, Mark Today button, warning/critical/safe banners |

### Cross-app features
- Offline banner + sync-on-reconnect
- Expiry critical ribbon (all tabs, navigates to Expiry)
- Auth loading spinner
- User avatar + sign out
- Dark mode (automatic, `prefers-color-scheme`)
- Expiry badge on bottom nav

---

## Brand Tokens (never override in components)
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
Dark mode overrides these automatically via `@media (prefers-color-scheme: dark)` — never hard-code light colors in components.

Fonts:
- Display: `'Instrument Serif'` — headlines, section titles, logo wordmark
- UI/Body: `'Geist'` — all interactive elements, body copy
- Data: `'Geist Mono'` — numbers, CPP values, labels, badges

---

## Adding Data

### New credit card program
1. Add to `cards` array in `data.service.ts` with `category: 'transferable' | 'airline' | 'hotel'`
2. Add to `EXPIRY_RULES` in `expiry.service.ts`

### New expiry rule
Add to `EXPIRY_RULES` in `expiry.service.ts`. Types: `'activity'`, `'fixed'`, `'never'`.

### New flight/hotel recommendation set
Add a new route key to `flightRecs` or `hotelRecs` in `data.service.ts`, then add the airport codes to the corresponding Set in `optimizer.service.ts` and add a case to `detectRoute()`.

### New sweet spot
Add to `sweetSpots` array in `data.service.ts` with `category: 'flight' | 'hotel' | 'promo'`.

### New transfer bonus
Add to `transferBonuses` array in `data.service.ts`. The Sweet Spots tab auto-hides expired bonuses (`expires` date compared to today).

---

## Deploy Flow

### Angular → Vercel (auto)
```bash
cd tally
npm run preflight:prod             # verify production config before deploy
ng build                          # verify clean build — catches template errors ng serve misses
git add .
git commit -m "feat: your change"
git push origin main              # Vercel auto-deploys in ~30s
```

### API → Vercel (auto)
```bash
cd api
npm run preflight:prod             # verify production config before deploy
npm run build                     # tsc — verify TypeScript is clean
git add .
git commit -m "feat: api change"
git push origin main              # Vercel auto-deploys
```

### DB migrations
```bash
cd api
npx prisma migrate dev --name your_migration_name   # creates + applies locally
# Run `npm run db:migrate` before production deploys that include migrations
```

---

## Environment Variables

### api/.env (local — gitignored)
| Var | Value |
|---|---|
| `DATABASE_URL` | Supabase session pooler URL (port 5432) |
| `DATABASE_URL_POOLED` | Supabase transaction pooler URL (port 6543, `?pgbouncer=true`) |
| `AUTH0_DOMAIN` | `dev-2iqdjh6lgnv6pnz5.us.auth0.com` |
| `AUTH0_AUDIENCE` | `https://api.tally.app` |
| `WAITLIST_WEBHOOK_URL` | n8n waitlist webhook URL, optional locally |
| `PORT` | `3000` |

### Vercel API environment variables (set in dashboard)
Same vars as above. Also set `NODE_ENV=production` and `APP_ORIGINS` for the production Angular and landing-page origins.

### Production API URL
`tally/src/environments/environment.production.ts` points to `https://tally-api.vercel.app`.
The PWA `dataGroups` in `tally/ngsw-config.json` must use the same API origin.

### Observability
The API sets `X-Request-Id` on every response and logs failed requests with that ID. Angular has disabled-by-default `analytics` and `errorReporting` transports in the environment files; do not enable them until a provider endpoint is configured and reviewed for PII.

---

## Known Build Notes
- Google Fonts loaded via `<link>` in `index.html`, NOT `@import` in SCSS (causes build-time 403)
- Font inlining disabled in `angular.json` (`optimization.fonts: false`)
- Component style budget: `anyComponentStyle` warning at 8 kB, error at 12 kB
- Auth0 SDK adds ~208 kB to the bundle; initial bundle budget raised to 700 kB warn / 1 MB error
- PWA icons live in `public/icons/` and are referenced by `src/manifest.webmanifest`
- Feature tabs are loaded through Angular `@defer` blocks in `AppComponent`; keep new heavy tab UI out of the initial app shell.

---

## Not Implemented Yet (next priorities)
1. **Vercel API deploy** — configure the API project env vars and verify `https://tally-api.vercel.app/health`
2. Import n8n workflows and set `WAITLIST_WEBHOOK_URL` on the Vercel API project
3. Configure analytics endpoint/provider and enable `environment.analytics.enabled`
4. Stripe billing (`$6.99/mo` or `$49/yr`)
5. Seats.aero API for live award availability
6. Web push notifications for expiry alerts + Flying Blue promos

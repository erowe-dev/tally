# AGENTS.md — Tally Points Advisor

## Project Overview
Tally is a mobile-first PWA that helps intermediate credit card points earners optimize transfer decisions for flights and hotel redemptions. Built with Angular 18 + Auth0 + Express API + Supabase PostgreSQL. Deployed to Vercel (Angular) and Render (API) via GitHub (`erowe-dev/tally`, auto-deploys on push to `main`).

**This is NOT part of any other codebase. Never mix references, patterns, or imports from other projects.**

---

## Tech Stack
- **Framework:** Angular 18, standalone components (no NgModules anywhere)
- **State:** Angular Signals (`signal()`, `computed()`, `effect()`) — prefer over RxJS/BehaviorSubject
- **Auth:** Auth0 SPA (`@auth0/auth0-angular`), domain `dev-2iqdjh6lgnv6pnz5.us.auth0.com`
- **API:** Express + TypeScript in `api/` — deployed on Render
- **Database:** Supabase (PostgreSQL) + Prisma ORM
- **Persistence:** `localStorage` write-through cache; API is source of truth on load
- **PWA:** `@angular/service-worker` + `ngsw-config.json`
- **Styling:** Component-scoped SCSS + global CSS custom properties in `src/styles.scss`
- **Angular deploy:** Vercel (auto-deploy on push to `main`, root dir = `tally/`)
- **API deploy:** Render (web service, root dir = `api/`)

---

## Repository Structure
```
tally/                                   ← Angular app (Vercel root dir)
├── src/app/
│   ├── core/
│   │   ├── models/index.ts              # All TypeScript interfaces + NavTab type
│   │   └── services/
│   │       ├── auth.service.ts          # Auth0 wrapper: signals + provisioning + retry
│   │       ├── api.service.ts           # Authenticated HTTP client (getBalances, setBalance, etc.)
│   │       ├── network.service.ts       # Online/offline signal (window events)
│   │       ├── data.service.ts          # Static card/partner/recommendation data
│   │       ├── wallet.service.ts        # Balance tracking — signals + localStorage + API sync
│   │       ├── optimizer.service.ts     # Route detection + transfer recommendations
│   │       └── expiry.service.ts        # Per-program expiry rules engine + API sync
│   ├── features/
│   │   ├── optimizer/                   # Transfer optimizer tab (protected)
│   │   ├── wallet/                      # Points wallet tab (protected)
│   │   ├── cards/                       # Cards & partners reference tab (public)
│   │   ├── sweetspots/                  # Curated sweet spots tab (public)
│   │   └── expiry/                      # Points expiry tracker tab (protected)
│   └── shared/components/
│       ├── tally-logo/                  # Logo component (size + showText inputs)
│       └── bottom-nav/                  # Bottom nav with expiry badge + lock dots
├── src/environments/
│   ├── environment.ts                   # Dev: localhost API + Auth0 dev app
│   └── environment.production.ts        # Prod: Render API URL + same Auth0 app
api/                                     ← Express API (Render root dir)
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
│       └── expiry.ts                    # GET/PUT/DELETE /api/expiry/:cardId
└── prisma/schema.prisma                 # User, Balance, ExpiryRecord models
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

### API sync pattern (wallet + expiry)
```
1. On login: effect() fires when isResolved() && isAuthenticated() && isProvisioned() && isOnline()
2. GET /api/{resource} → if API empty + local has data → push local up; else API overwrites local
3. Writes: update signal + localStorage immediately, then fire-and-forget API call
4. Error: reset _apiLoaded=false so retry happens when network comes back
```

### File conventions
- One component per file, filename matches selector
- Services are `providedIn: 'root'`
- All interfaces in `src/app/core/models/index.ts`

### Data
- Static data (cards, partners, recommendations, sweet spots) lives in `data.service.ts`
- `localStorage` keys: `tally_wallet_v1`, `tally_expiry_v1`
- Always wrap `localStorage` in try/catch

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
Fonts:
- Display: `'Instrument Serif'` — headlines, section titles, logo wordmark
- UI/Body: `'Geist'` — all interactive elements, body copy
- Data: `'Geist Mono'` — numbers, CPP values, labels, badges

---

## Adding Data

### New credit card program
Add to `cards` array in `data.service.ts`, also add to `EXPIRY_RULES` in `expiry.service.ts`.

### New expiry rule
Add to `EXPIRY_RULES` in `expiry.service.ts`. Types: `'activity'`, `'fixed'`, `'never'`.

### New flight/hotel recommendation set
Add to `flightRecs` or `hotelRecs` in `data.service.ts`.

---

## Deploy Flow

### Angular → Vercel (auto)
```bash
cd tally
ng build                          # verify clean build — catches template errors ng serve misses
git add .
git commit -m "feat: your change"
git push origin main              # Vercel auto-deploys in ~30s
```

### API → Render (auto)
```bash
cd api
npm run build                     # tsc — verify TypeScript is clean
git add .
git commit -m "feat: api change"
git push origin main              # Render auto-deploys
```

### DB migrations
```bash
cd api
npx prisma migrate dev --name your_migration_name   # creates + applies locally
# Render runs `npm run db:migrate` (prisma migrate deploy) on each deploy
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
| `PORT` | `3000` |

### Render environment variables (set in dashboard)
Same 5 vars as above. `NODE_ENV=production` also set by Render automatically.

### ⚠️ Remaining TODO before production
`tally/src/environments/environment.production.ts` → `apiUrl` is still `'TODO_YOUR_RENDER_API_URL'`.
After creating the Render service, replace with the actual URL (e.g. `https://tally-api.onrender.com`), then push to trigger a Vercel rebuild.

---

## Known Build Notes
- `@angular/service-worker` must stay at version 18.x to match Angular core
- Google Fonts loaded via `<link>` in `index.html`, NOT `@import` in SCSS (causes build-time 403)
- Font inlining disabled in `angular.json` (`optimization.fonts: false`)
- Component style budget warnings for `optimizer` and `expiry` are expected — ignore them
- Auth0 SDK adds ~208 kB to the bundle; initial bundle budget raised to 700 kB warn / 1 MB error

---

## Not Implemented Yet (next priorities)
1. **Render deploy** — create Render service, fill `TODO_YOUR_RENDER_API_URL` in `environment.production.ts`
2. Wire `landing/index.html` waitlist form to n8n webhook (`submitEmail()` currently logs)
3. Generate PWA icons: `npm install --save-dev canvas && npm run icons`
4. Saved trips feature
5. Stripe billing (`$6.99/mo` or `$49/yr`)
6. Seats.aero API for live award availability
7. Web push notifications for expiry alerts + Flying Blue promos

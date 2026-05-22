# Tally Private Alpha Production Runbook

This runbook is for the private alpha production milestone: Angular app on Vercel, Express API on Vercel Functions, Auth0 sign-in, and Supabase-backed sync.

## Release Gate

Before deploying, make sure the release branch contains one coherent production-readiness commit and no legacy platform names or placeholder production values.

Known open gates right now:

- `https://tally-api.vercel.app/health` currently returns Vercel `NOT_FOUND`; the API project/alias must deploy before alpha.
- `https://tally-theta-two.vercel.app` is deployed, but currently serves the landing page rather than the Angular PWA shell; PWA assets such as `manifest.webmanifest` still return `NOT_FOUND`.
- The Angular app has production dependency audit findings tied mostly to Angular 18; accept that risk only for private alpha, not public beta.

Required local verification before deploy:

```bash
cd tally
npm run preflight:prod
npm run verify

cd ../api
npm run preflight:prod
npm run verify
```

Required production verification after deploy:

```bash
cd tally
npm run smoke:prod
```

Override the default URLs when testing preview/custom domains:

```bash
TALLY_APP_URL=https://<app-host> TALLY_API_URL=https://<api-host> npm run smoke:prod
```

## Hosting Projects

Use Vercel for both the Angular app and the API:

- Angular app: preferred root directory `tally/`, output `dist/tally/browser`, production app URL currently `https://tally-theta-two.vercel.app`.
- Repo-root fallback: if the Vercel project is accidentally rooted at the repository root, committed `vercel.json` builds `tally/` and serves `tally/dist/tally/browser`.
- API: root directory `api/`, Vercel Functions, production API URL `https://tally-api.vercel.app`.

Dashboard setup:

1. Open Vercel team `erowe-dev's projects`.
2. Confirm project `tally` has Root Directory `tally`, Build Command `npm run build`, and Output Directory `dist/tally/browser`; if it is rooted at the repository root instead, confirm it uses committed `vercel.json`.
3. Confirm project `tally-api` has Root Directory `api`.
4. Confirm the API project uses the committed `api/vercel.json` function routing.
5. Add the API environment variables below before the first API deploy.
6. Push to `main`; Vercel auto-deploys both configured projects.
7. After both projects deploy, run `npm run smoke:prod` from `tally/`.

If deploying the Angular app with the Vercel CLI:

```bash
nvm use 20

cd tally
vercel link --yes --project tally
vercel --prod
```

Use Node 20+ for Vercel CLI work. Node 18 can install the CLI through `npx`, but current Vercel packages warn that they require Node 20 or newer. The existing Vercel `tally` project currently reports Node 24, which is compatible with the package `engines` range.

## API Environment

Set these on the Vercel API project:

```text
DATABASE_URL=<Supabase session/direct URL>
DATABASE_URL_POOLED=<Supabase transaction pooler URL with pgbouncer=true>
AUTH0_DOMAIN=dev-2iqdjh6lgnv6pnz5.us.auth0.com
AUTH0_AUDIENCE=https://api.tally.app
APP_ORIGINS=https://tally-theta-two.vercel.app,https://tally.vercel.app,https://tallypoints.app,https://www.tallypoints.app
WAITLIST_WEBHOOK_URL=https://<your-n8n-host>/webhook/tally-waitlist
PORT=3000
```

`DATABASE_URL_POOLED` is required in production so Prisma uses Supabase pooling.
`WAITLIST_WEBHOOK_URL` enables the landing-page signup forms; without it, the API returns a 503 and the page offers a manual email fallback.

## Observability

The API emits `X-Request-Id` on every response, includes service/version/database metadata in `/health`, and logs structured warning/error lines for failed requests. When investigating a production issue, copy the `X-Request-Id` from the browser Network tab and search Vercel function logs for the same value.

Angular has disabled-by-default analytics and error-reporting transports in `environment*.ts`. Keep them disabled until the endpoint/provider is chosen, then verify no PII or raw balance values are sent before enabling for alpha users.

## Auth0 Settings

In the Auth0 SPA application, include production origins:

```text
Allowed Callback URLs: https://tally-theta-two.vercel.app
Allowed Logout URLs: https://tally-theta-two.vercel.app
Allowed Web Origins: https://tally-theta-two.vercel.app
API Audience: https://api.tally.app
```

Add the final custom domain to each list before pointing invited alpha users there.

## Landing Page

The bundled landing page submits to `https://tally-api.vercel.app/api/waitlist`, which proxies to the n8n workflow configured by `WAITLIST_WEBHOOK_URL`. If the webhook is unavailable, the page shows a manual `mailto:hello@tallypoints.app` fallback instead of a fake success.

## Offline Read Cache

Wallet and Expiry authenticated GETs use an explicit one-hour localStorage read-through cache:

- `tally_cache_balances`
- `tally_cache_expiry`

The app still treats local state as immediately authoritative for user edits. The read cache only helps first authenticated loads recover from a failed cross-origin API read; write endpoints are never cached.

## Database

No new migration is required for the current private alpha release unless Prisma reports drift.

When a migration is added later:

```bash
cd api
npx prisma migrate dev --name <migration_name>
npm run db:migrate
```

## Smoke Test

Block the alpha invite until all of these pass in production:

- `GET https://tally-api.vercel.app/health` returns `{ "status": "ok" }`.
- `/health` includes `X-Request-Id`, `service: "tally-api"`, and `database: "ok"`.
- Signed-out users can open public tabs.
- Protected tabs show sign-in prompts.
- Auth0 login returns to the app and provisions the user through `POST /api/users/me`.
- Wallet balances save and survive refresh.
- Expiry records save and survive refresh.
- Flight and hotel recommendations can be saved as trips.
- Trip notes can be edited, one trip can be deleted, and all trips can be cleared.
- A second browser session sees server-backed synced data.
- Unauthenticated calls to `/api/balances`, `/api/expiry`, and `/api/trips` are rejected.
- `POST /api/waitlist` rejects invalid emails with 400 and allows `https://tallypoints.app` via CORS.
- Deployed `ngsw.json` includes API freshness data groups only for balances and expiry.
- Failed API calls in the browser include an `X-Request-Id` that appears in Vercel logs.

## Browser Accessibility Pass

Before the first external alpha invite, run a manual browser pass with DevTools Lighthouse or AXE on:

- Signed-out public Cards tab.
- Signed-out protected-tab login prompt.
- Signed-in Wallet tab with onboarding visible.
- Optimizer results with the "How to book" panel open.
- Expiry tab with warning/critical states.
- Toast stack after forcing an API failure.

Minimum pass criteria:

- All interactive controls are keyboard reachable.
- Focus rings are visible on buttons, links, form inputs, and tab navigation.
- Color contrast passes WCAG AA.
- Form inputs have visible labels or accessible names.
- Toasts are dismissible and do not trap focus.

## Rollback

If production fails after deploy:

```bash
vercel rollback
```

Rollback the API project first when sync/auth routes are broken. Rollback the Angular app first when the app shell, Auth0 callback, or PWA assets are broken.

# Tally Private Alpha Production Runbook

This runbook is for the private alpha production milestone: Angular app on Vercel, Express API on Vercel Functions, Auth0 sign-in, and Supabase-backed sync.

## Release Gate

Before deploying, make sure the release branch contains one coherent production-readiness commit and no legacy platform names or placeholder production values.

Known open gates right now:

- `https://tally-api-theta.vercel.app/health` must return `status: "ok"`, `database: "ok"`, and `schema: "ok"`.
- `https://tally-theta-two.vercel.app` must serve the Angular PWA shell at `/`, with the waitlist landing page preserved at `/landing/`.
- The Angular app has production dependency audit findings tied mostly to Angular 18; accept that risk only for private alpha, not public beta.

Required local verification before deploy:

```bash
cd tally
npm run preflight:prod
npm run audit:prod
npm run verify

cd ../api
npm run preflight:prod
npm run verify
```

`tally/npm run audit:prod` fails on critical Angular app dependency findings while accepting the current Angular 18 baseline for private alpha. `api/npm run verify` includes a strict production dependency audit. Keep both green before deploys; the Angular high/moderate findings remain a tracked public-beta upgrade gate.

GitHub Actions runs the same app/API verification on pull requests and pushes to `main` via `.github/workflows/production-readiness.yml`. Treat a failed workflow as a release blocker.

Required production verification after deploy:

```bash
cd tally
npm run check:deploy:fresh
npm run smoke:release
```

`npm run smoke:release` runs the deployment freshness check before hitting the live app/API. Do not call production ready until both the app and API aliases point at deployments newer than the latest relevant commits. If Vercel returns the free daily deployment quota error, stop inviting testers and retry after the quota window resets; local builds can still be green while production remains stale.

For external alpha invites, make authenticated smoke mandatory:

```bash
cd tally
$env:TALLY_AUTH_TOKEN="<Auth0 access token for https://api.tally.app>"
$env:TALLY_AUTH_EMAIL="<your Auth0 email>"
$env:TALLY_REQUIRE_AUTH_SMOKE="1"
npm run smoke:release
```

The authenticated smoke provisions your user, rejects an unknown synthetic program ID, writes and restores a Chase UR smoke balance, restores or removes preferences after validating held-program persistence, writes/deletes a synthetic expiry record, creates/edits/deletes a temporary saved search, checks provider-backed award availability, and creates/edits/deletes a temporary saved trip.

The `Production smoke` GitHub Actions job can also be run manually with repository secrets `TALLY_AUTH_TOKEN` and `TALLY_AUTH_EMAIL`; it sets `TALLY_REQUIRE_AUTH_SMOKE=1` so missing credentials fail loudly.

Override the default URLs when testing preview/custom domains:

```bash
TALLY_APP_URL=https://<app-host> TALLY_API_URL=https://<api-host> npm run smoke:release
```

For a preview or non-Vercel custom-domain smoke where `vercel inspect` cannot identify the deployment, set `TALLY_SKIP_DEPLOY_FRESHNESS=1` and record the deployment URL manually in the release notes. Never use that override for the canonical production aliases.

## Hosting Projects

Use Vercel for both the Angular app and the API:

- Angular app: production project root directory is `tally`, prepares the Angular output into `tally/browser`, output directory `browser`, production app URL currently `https://tally-theta-two.vercel.app`.
- Root fallback: committed root `vercel.json` mirrors `tally/vercel.json` so CLI deploys from the repository root use the same build/output behavior as the configured project root.
- API: root directory `api/`, Vercel Functions, production API URL `https://tally-api-theta.vercel.app`.

Dashboard setup:

1. Open Vercel team `erowe-dev's projects`.
2. Confirm project `tally` has Root Directory `tally` and Output Directory `browser`; if root, build-command, or output behavior changes, rerun `npm run smoke:release` before sharing the app URL.
3. Confirm project `tally-api` has Root Directory `api`.
4. Confirm the API project uses the committed `api/vercel.json` function routing.
5. Add the API environment variables below before the first API deploy.
6. Push to `main`; confirm the Angular app deploys automatically.
7. Confirm the API project also creates a new deployment. If it does not, deploy it manually from `api/` with the Vercel CLI until the dashboard Git connection is repaired.
8. After both projects deploy, run `npm run smoke:release` from `tally/`.

If deploying the Angular app with the Vercel CLI:

```bash
nvm use 20

cd tally
vercel link --yes --project tally
vercel --prod
```

When deploying from this repository after the project is already linked, prefer running `vercel --prod --yes` from the repository root so the root `.vercelignore` excludes local build artifacts and the API workspace from the upload.

If deploying the API with the Vercel CLI:

```bash
nvm use 20

cd api
vercel link --yes --project tally-api
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
`WAITLIST_WEBHOOK_URL` is reserved for a later waitlist reopening. For this private-alpha milestone, signup is deliberately closed and the API returns a 410 response with the manual contact email.

## Observability

The API emits `X-Request-Id` on every response, includes service/version/database metadata in `/health`, and logs structured warning/error lines for failed requests. When investigating a production issue, copy the `X-Request-Id` from the browser Network tab and search Vercel function logs for the same value.

Production analytics and error reporting are enabled and send privacy-scoped payloads to `/api/telemetry/analytics` and `/api/telemetry/errors`. The API accepts only configured first-party origins, rejects missing origins for telemetry, does not require auth for telemetry writes, and stores only bounded event/error context. Keep telemetry payloads free of PII, raw balances, full URLs with query strings, access tokens, and Auth0 identifiers.

Development telemetry stays disabled in `environment.ts` so local work does not pollute production logs.

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

The bundled landing page remains available at `/landing/`, but signup is disabled while the private alpha is invite-only. The forms do not call `/api/waitlist`; they show closed/invite-only copy and direct interested users to `mailto:hello@tallypoints.app`.

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

- `GET https://tally-api-theta.vercel.app/health` returns `{ "status": "ok", "database": "ok", "schema": "ok" }`.
- `/health` includes `X-Request-Id`, `service: "tally-api"`, `version`, `database: "ok"`, and `schema: "ok"`.
- Signed-out users can open public tabs.
- Protected tabs show sign-in prompts.
- Auth0 login returns to the app and provisions the user through `POST /api/users/me`.
- Wallet balances save and survive refresh.
- Expiry records save and survive refresh.
- Flight and hotel recommendations can be saved as trips.
- Trip notes can be edited, one trip can be deleted, and all trips can be cleared.
- A second browser session sees server-backed synced data.
- Unauthenticated calls to `/api/users/me`, `/api/balances`, `/api/expiry`, `/api/trips`, `/api/preferences`, `/api/searches`, `/api/search/award-availability`, and `/api/search/hotel-fit` are rejected, including destructive preference cleanup calls.
- `POST /api/waitlist` returns a deliberate 410 closed response with `contactEmail` and allows configured production origins via CORS.
- Disallowed browser origins return `403` with `X-Request-Id`, not `500`, and do not reflect the blocked origin in the response body.
- Telemetry accepts valid first-party analytics/error payloads, rejects unsupported analytics events, and rejects telemetry posts that omit `Origin`.
- Deployed `ngsw.json` does not cache authenticated API reads; services use their own localStorage read-through caches where applicable.
- Failed API calls in the browser include an `X-Request-Id` that appears in Vercel logs.
- `npm run smoke:release` passes with `TALLY_REQUIRE_AUTH_SMOKE=1`, `TALLY_AUTH_TOKEN`, and `TALLY_AUTH_EMAIL`.

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

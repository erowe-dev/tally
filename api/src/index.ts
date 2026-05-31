import 'dotenv/config';
import { validateEnv } from './lib/env';

// Validate env vars BEFORE any module that reads process.env at import time
// (e.g. middleware/auth.ts reads AUTH0_DOMAIN). Fails fast with a clear error.
validateEnv();

import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma';
import usersRouter from './routes/users';
import balancesRouter from './routes/balances';
import expiryRouter from './routes/expiry';
import tripsRouter from './routes/trips';
import waitlistRouter from './routes/waitlist';
import preferencesRouter from './routes/preferences';
import searchesRouter from './routes/searches';
import searchRouter from './routes/search';
import telemetryRouter from './routes/telemetry';
import { responseRequestId, sendError } from './lib/http-response';
import { buildAllowedOrigins, normalizeOrigin } from './lib/origin-allowlist';

const app = express();
app.disable('x-powered-by');
const port = parseInt(process.env['PORT'] ?? '3000', 10);
const startedAt = new Date().toISOString();
const serviceVersion = getServiceVersion();

const allowedOrigins = new Set(buildAllowedOrigins());

app.use((req, res, next) => {
  const requestId = getRequestId(req);
  res.locals['requestId'] = requestId;
  res.setHeader('X-Request-Id', requestId);

  const started = Date.now();
  res.on('finish', () => {
    if (res.statusCode < 400) return;
    console.warn(JSON.stringify({
      level: res.statusCode >= 500 ? 'error' : 'warn',
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started,
    }));
  });

  next();
});

// Basic security headers — no new package needed.
// Keep these before CORS so rejected browser-origin requests still get them.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Vercel health checks, etc.)
      const normalizedOrigin = normalizeOrigin(origin);
      if (!origin || (normalizedOrigin && allowedOrigins.has(normalizedOrigin))) {
        callback(null, true);
      } else {
        const error = new Error('CORS origin not allowed') as Error & { status: number };
        error.status = 403;
        callback(error);
      }
    },
    credentials: true,
  }),
);

// Reasonable body size cap — we only ever POST small JSON payloads
app.use(express.json({ limit: '32kb' }));

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await assertRequiredSchema();
    res.json({
      status: 'ok',
      service: 'tally-api',
      version: serviceVersion,
      startedAt,
      database: 'ok',
      schema: 'ok',
    });
  } catch (error) {
    const requestId = responseRequestId(res);
    const schemaError = error instanceof SchemaReadinessError ? error : null;
    res.status(503).json({
      status: 'error',
      service: 'tally-api',
      version: serviceVersion,
      startedAt,
      database: schemaError !== null ? 'ok' : 'unreachable',
      schema: schemaError !== null ? 'incomplete' : undefined,
      reason: schemaError !== null ? 'db_schema_incomplete' : 'db_unreachable',
      missing: schemaError?.missing,
      requestId,
    });
  }
});

app.use('/api/users', usersRouter);
app.use('/api/balances', balancesRouter);
app.use('/api/expiry', expiryRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/waitlist', waitlistRouter);
app.use('/api/preferences', preferencesRouter);
app.use('/api/searches', searchesRouter);
app.use('/api/search', searchRouter);
app.use('/api/telemetry', telemetryRouter);

app.use('/api', (_req, res) => {
  sendError(res, 404, 'API route not found');
});

// Fallback error handler — any error that reaches here is unexpected.
// Keeps the response shape consistent and avoids leaking stack traces.
app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  const status = err.status ?? 500;
  const requestId = responseRequestId(res);
  if (status >= 500) console.error('[api] Unhandled error:', { requestId, err });
  sendError(res, status, status < 500 ? err.message : 'Internal server error');
});

if (process.env['VERCEL'] !== '1') {
  app.listen(port, () => {
    console.log(`Tally API running on port ${port}`);
  });
}

export default app;

function getRequestId(req: express.Request): string {
  const fromHeader = req.header('x-request-id');
  if (fromHeader && fromHeader.length <= 100) return fromHeader;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getServiceVersion(): string {
  const candidates = [
    process.env['VERCEL_GIT_COMMIT_SHA'],
    process.env['COMMIT_SHA'],
    process.env['VERCEL_GIT_COMMIT_REF'],
    process.env['VERCEL_URL'],
  ];
  const version = candidates
    .map(candidate => candidate?.trim())
    .find((candidate): candidate is string => Boolean(candidate));
  return version ? version.slice(0, 12) : 'local';
}

const REQUIRED_TABLES = [
  'users',
  'balances',
  'expiry_records',
  'trips',
  'user_preferences',
  'saved_searches',
  'provider_cache',
];

const REQUIRED_COLUMNS = [
  'user_preferences.homeAirports',
  'user_preferences.preferredPrograms',
  'user_preferences.heldProgramIds',
  'saved_searches.dateWindow',
  'saved_searches.hotelIntent',
  'provider_cache.cacheKey',
  'provider_cache.normalizedRequest',
  'provider_cache.response',
  'provider_cache.expiresAt',
];

class SchemaReadinessError extends Error {
  constructor(readonly missing: string[]) {
    super(`Missing required schema: ${missing.join(', ')}`);
  }
}

async function assertRequiredSchema(): Promise<void> {
  const [tables, columns] = await Promise.all([
    prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `,
    prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
    `,
  ]);

  const presentTables = new Set(tables.map(row => row.table_name));
  const presentColumns = new Set(columns.map(row => `${row.table_name}.${row.column_name}`));
  const missing = [
    ...REQUIRED_TABLES.filter(table => !presentTables.has(table)).map(table => `table:${table}`),
    ...REQUIRED_COLUMNS.filter(column => !presentColumns.has(column)).map(column => `column:${column}`),
  ];

  if (missing.length > 0) throw new SchemaReadinessError(missing);
}

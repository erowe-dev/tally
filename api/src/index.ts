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

const app = express();
const port = parseInt(process.env['PORT'] ?? '3000', 10);
const startedAt = new Date().toISOString();
const serviceVersion =
  process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 12) ??
  process.env['COMMIT_SHA']?.slice(0, 12) ??
  'local';

const defaultAllowedOrigins = [
  'http://localhost:4200',
  'https://tally-theta-two.vercel.app',
  'https://tally.vercel.app',
  'https://tallypoints.app',
  'https://www.tallypoints.app',
];
const configuredOrigins = (process.env['APP_ORIGINS'] ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])];

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

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Vercel health checks, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);

// Reasonable body size cap — we only ever POST small JSON payloads
app.use(express.json({ limit: '32kb' }));

// Basic security headers — no new package needed
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      service: 'tally-api',
      version: serviceVersion,
      startedAt,
      database: 'ok',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      service: 'tally-api',
      version: serviceVersion,
      startedAt,
      database: 'unreachable',
      reason: 'db_unreachable',
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

// Fallback error handler — any error that reaches here is unexpected.
// Keeps the response shape consistent and avoids leaking stack traces.
app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  const status = err.status ?? 500;
  const requestId = typeof res.locals['requestId'] === 'string' ? res.locals['requestId'] : 'unknown';
  if (status >= 500) console.error('[api] Unhandled error:', { requestId, err });
  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error',
    requestId,
  });
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

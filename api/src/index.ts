import 'dotenv/config';
import { validateEnv } from './lib/env';

// Validate env vars BEFORE any module that reads process.env at import time
// (e.g. middleware/auth.ts reads AUTH0_DOMAIN). Fails fast with a clear error.
validateEnv();

import express from 'express';
import cors from 'cors';
import usersRouter from './routes/users';
import balancesRouter from './routes/balances';
import expiryRouter from './routes/expiry';

const app = express();
const port = parseInt(process.env['PORT'] ?? '3000', 10);

const allowedOrigins = [
  'http://localhost:4200',
  'https://tally-theta-two.vercel.app',
  'https://tally.vercel.app',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Render health checks, etc.)
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

// Health check — Render pings this to keep the service warm
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/users', usersRouter);
app.use('/api/balances', balancesRouter);
app.use('/api/expiry', expiryRouter);

// Fallback error handler — any error that reaches here is unexpected.
// Keeps the response shape consistent and avoids leaking stack traces.
app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  const status = err.status ?? 500;
  if (status >= 500) console.error('[api] Unhandled error:', err);
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Tally API running on port ${port}`);
});

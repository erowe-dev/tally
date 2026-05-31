import { Router, type Request, type Response, type NextFunction } from 'express';
import { asyncRoute } from '../lib/route-helpers';

const router = Router();
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'https://tally-theta-two.vercel.app',
  'https://tally.vercel.app',
  'https://tallypoints.app',
  'https://www.tallypoints.app',
];
const CONFIGURED_ORIGINS = (process.env['APP_ORIGINS'] ?? '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...CONFIGURED_ORIGINS]);

const ANALYTICS_EVENTS = new Set([
  'tab_viewed',
  'optimizer_search',
  'sweet_spot_favorited',
  'balance_updated',
  'transfer_calculated',
  'sweet_spots_deep_linked',
]);

const ERROR_CONTEXTS = new Set([
  'angular_unhandled',
  'manual',
  'smoke',
]);

router.use(requireAllowedOrigin);

router.post(
  '/analytics',
  asyncRoute(async (req, res) => {
    const body = asRecord(req.body);
    if (!body) {
      res.status(400).json({ error: 'Request body must be an object' });
      return;
    }

    const event = stringValue(body['event'], 80);
    const timestamp = stringValue(body['timestamp'], 40);
    const properties = asRecord(body['properties']) ?? {};

    if (!event || !ANALYTICS_EVENTS.has(event)) {
      res.status(400).json({ error: 'Unsupported analytics event' });
      return;
    }

    console.info(JSON.stringify({
      level: 'info',
      kind: 'analytics',
      requestId: res.locals['requestId'],
      event,
      properties: sanitizeProps(properties),
      timestamp: validTimestamp(timestamp),
    }));

    res.status(204).end();
  }),
);

router.post(
  '/errors',
  asyncRoute(async (req, res) => {
    const body = asRecord(req.body);
    if (!body) {
      res.status(400).json({ error: 'Request body must be an object' });
      return;
    }

    const message = stringValue(body['message'], 500);
    const context = stringValue(body['context'], 80);

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }
    if (context && !ERROR_CONTEXTS.has(context)) {
      res.status(400).json({ error: 'Unsupported error context' });
      return;
    }

    const logPayload = JSON.stringify({
      level: context === 'smoke' ? 'info' : 'error',
      kind: 'client_error',
      requestId: res.locals['requestId'],
      context: context || 'manual',
      message,
      stack: stringValue(body['stack'], 2000),
      url: stringValue(body['url'], 500),
      timestamp: validTimestamp(stringValue(body['timestamp'], 40)),
    });
    if (context === 'smoke') {
      console.info(logPayload);
    } else {
      console.error(logPayload);
    }

    res.status(204).end();
  }),
);

export default router;

function requireAllowedOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    res.status(403).json({ error: 'Telemetry origin not allowed' });
    return;
  }
  next();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validTimestamp(value: string): string {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function sanitizeProps(value: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value).slice(0, 20)) {
    const cleanKey = key.trim().slice(0, 60);
    if (!cleanKey) continue;
    if (typeof raw === 'string') {
      result[cleanKey] = raw.slice(0, 200);
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[cleanKey] = raw;
    } else if (typeof raw === 'boolean' || raw === null) {
      result[cleanKey] = raw;
    }
  }
  return result;
}

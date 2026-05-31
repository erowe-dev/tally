import { Router } from 'express';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute, requireUser, validateCardId } from '../lib/route-helpers';
import { KNOWN_PROGRAM_ID_SET } from '../lib/program-ids';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates a YYYY-MM-DD string semantically (not just format) — e.g. rejects
 * '2026-13-99' that would pass a regex but make a garbage Date.
 */
function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/expiry
// Returns Record<cardId, { cardId, lastActivityDate }> — matches ExpiryService shape.
router.get(
  '/',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const rows = await prisma.expiryRecord.findMany({ where: { userId: user.id } });

    const result: Record<string, { cardId: string; lastActivityDate: string }> = {};
    for (const r of rows) {
      if (KNOWN_PROGRAM_ID_SET.has(r.cardId)) {
        result[r.cardId] = { cardId: r.cardId, lastActivityDate: r.lastActivityDate };
      }
    }
    res.json(result);
  }),
);

// PUT /api/expiry/:cardId
// Upserts a last activity date. Body: { lastActivityDate: 'YYYY-MM-DD' }
router.put(
  '/:cardId',
  checkJwt,
  jwtErrorHandler,
  validateCardId,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const { cardId } = req.params;
    const { lastActivityDate } = req.body as { lastActivityDate?: unknown };

    const today = localDateString();
    if (typeof lastActivityDate !== 'string' || !isValidDateString(lastActivityDate) || lastActivityDate > today) {
      res.status(400).json({ error: 'lastActivityDate must be a valid YYYY-MM-DD string not in the future' });
      return;
    }

    const record = await prisma.expiryRecord.upsert({
      where: { userId_cardId: { userId: user.id, cardId } },
      update: { lastActivityDate },
      create: { userId: user.id, cardId, lastActivityDate },
    });

    res.json({ cardId: record.cardId, lastActivityDate: record.lastActivityDate });
  }),
);

// DELETE /api/expiry/:cardId
router.delete(
  '/:cardId',
  checkJwt,
  jwtErrorHandler,
  validateCardId,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const { cardId } = req.params;

    await prisma.expiryRecord.deleteMany({
      where: { userId: user.id, cardId },
    });

    res.status(204).send();
  }),
);

export default router;

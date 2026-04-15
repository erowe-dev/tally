import { Router, Request, Response } from 'express';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser(auth0Id: string) {
  const user = await prisma.user.findUnique({ where: { auth0Id } });
  if (!user) {
    throw Object.assign(new Error('User not found — call POST /api/users/me first'), {
      status: 404,
    });
  }
  return user;
}

// GET /api/expiry
// Returns Record<cardId, { cardId, lastActivityDate }> — matches ExpiryService shape.
router.get(
  '/',
  checkJwt,
  jwtErrorHandler,
  async (req: Request, res: Response) => {
    try {
      const user = await requireUser(getAuth0Id(req));
      const rows = await prisma.expiryRecord.findMany({ where: { userId: user.id } });

      const result: Record<string, { cardId: string; lastActivityDate: string }> = {};
      rows.forEach(r => {
        result[r.cardId] = { cardId: r.cardId, lastActivityDate: r.lastActivityDate };
      });

      res.json(result);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: String(err) });
    }
  },
);

// PUT /api/expiry/:cardId
// Upserts a last activity date. Body: { lastActivityDate: 'YYYY-MM-DD' }
router.put(
  '/:cardId',
  checkJwt,
  jwtErrorHandler,
  async (req: Request, res: Response) => {
    try {
      const user = await requireUser(getAuth0Id(req));
      const { cardId } = req.params;
      const { lastActivityDate } = req.body as { lastActivityDate?: unknown };

      if (typeof lastActivityDate !== 'string' || !DATE_RE.test(lastActivityDate)) {
        res.status(400).json({ error: 'lastActivityDate must be a string in YYYY-MM-DD format' });
        return;
      }

      const record = await prisma.expiryRecord.upsert({
        where: { userId_cardId: { userId: user.id, cardId } },
        update: { lastActivityDate },
        create: { userId: user.id, cardId, lastActivityDate },
      });

      res.json(record);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: String(err) });
    }
  },
);

// DELETE /api/expiry/:cardId
router.delete(
  '/:cardId',
  checkJwt,
  jwtErrorHandler,
  async (req: Request, res: Response) => {
    try {
      const user = await requireUser(getAuth0Id(req));
      const { cardId } = req.params;

      await prisma.expiryRecord.deleteMany({
        where: { userId: user.id, cardId },
      });

      res.status(204).send();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: String(err) });
    }
  },
);

export default router;

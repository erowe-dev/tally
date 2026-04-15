import { Router, Request, Response } from 'express';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

async function requireUser(auth0Id: string) {
  const user = await prisma.user.findUnique({ where: { auth0Id } });
  if (!user) {
    throw Object.assign(new Error('User not found — call POST /api/users/me first'), {
      status: 404,
    });
  }
  return user;
}

// GET /api/balances
// Returns all balances as Record<cardId, amount> — matches WalletService shape.
router.get(
  '/',
  checkJwt,
  jwtErrorHandler,
  async (req: Request, res: Response) => {
    try {
      const user = await requireUser(getAuth0Id(req));
      const rows = await prisma.balance.findMany({ where: { userId: user.id } });

      const result: Record<string, number> = {};
      rows.forEach(b => { result[b.cardId] = b.amount; });

      res.json(result);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: String(err) });
    }
  },
);

// PUT /api/balances/:cardId
// Upserts a single balance. Body: { amount: number }
router.put(
  '/:cardId',
  checkJwt,
  jwtErrorHandler,
  async (req: Request, res: Response) => {
    try {
      const user = await requireUser(getAuth0Id(req));
      const { cardId } = req.params;
      const { amount } = req.body as { amount?: unknown };

      if (typeof amount !== 'number' || amount < 0 || !Number.isFinite(amount)) {
        res.status(400).json({ error: 'amount must be a non-negative finite number' });
        return;
      }

      const balance = await prisma.balance.upsert({
        where: { userId_cardId: { userId: user.id, cardId } },
        update: { amount: Math.round(amount) },
        create: { userId: user.id, cardId, amount: Math.round(amount) },
      });

      res.json(balance);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status).json({ error: String(err) });
    }
  },
);

export default router;

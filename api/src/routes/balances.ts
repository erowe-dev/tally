import { Router } from 'express';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute, requireUser, validateCardId } from '../lib/route-helpers';

const router = Router();

// GET /api/balances
// Returns all balances as Record<cardId, amount> — matches WalletService shape.
router.get(
  '/',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const rows = await prisma.balance.findMany({ where: { userId: user.id } });

    const result: Record<string, number> = {};
    for (const b of rows) result[b.cardId] = b.amount;
    res.json(result);
  }),
);

// PUT /api/balances/:cardId
// Upserts a single balance. Body: { amount: number }
router.put(
  '/:cardId',
  checkJwt,
  jwtErrorHandler,
  validateCardId,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const { cardId } = req.params;
    const { amount } = req.body as { amount?: unknown };

    if (typeof amount !== 'number' || amount < 0 || !Number.isFinite(amount)) {
      res.status(400).json({ error: 'amount must be a non-negative finite number' });
      return;
    }

    const rounded = Math.round(amount);
    const balance = await prisma.balance.upsert({
      where: { userId_cardId: { userId: user.id, cardId } },
      update: { amount: rounded },
      create: { userId: user.id, cardId, amount: rounded },
    });

    res.json({ cardId: balance.cardId, amount: balance.amount });
  }),
);

export default router;

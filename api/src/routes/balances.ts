import { Router } from 'express';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute, requireUser, validateCardId } from '../lib/route-helpers';
import { KNOWN_PROGRAM_ID_SET } from '../lib/program-ids';
import { sendError } from '../lib/http-response';

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
    for (const b of rows) {
      if (KNOWN_PROGRAM_ID_SET.has(b.cardId)) {
        result[b.cardId] = b.amount;
      }
    }
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

    const parsedAmount = parseBalanceAmount(amount);
    if ('error' in parsedAmount) {
      sendError(res, 400, parsedAmount.error);
      return;
    }

    const balance = await prisma.balance.upsert({
      where: { userId_cardId: { userId: user.id, cardId } },
      update: { amount: parsedAmount.data },
      create: { userId: user.id, cardId, amount: parsedAmount.data },
    });

    res.json({ cardId: balance.cardId, amount: balance.amount });
  }),
);

// DELETE /api/balances/:cardId
// Removes a single balance row. Useful for smoke cleanup and for treating
// "no balance" as distinct from a persisted zero-balance record.
router.delete(
  '/:cardId',
  checkJwt,
  jwtErrorHandler,
  validateCardId,
  asyncRoute(async (req, res) => {
    const user = await requireUser(getAuth0Id(req));
    const { cardId } = req.params;

    await prisma.balance.deleteMany({
      where: { userId: user.id, cardId },
    });

    res.status(204).send();
  }),
);

export default router;

type ParseResult<T> = { data: T } | { error: string };

const MAX_BALANCE = 50_000_000;

export function parseBalanceAmount(amount: unknown): ParseResult<number> {
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    !Number.isInteger(amount) ||
    amount < 0 ||
    amount > MAX_BALANCE
  ) {
    return { error: `amount must be a non-negative integer ≤ ${MAX_BALANCE}` };
  }

  return { data: amount };
}

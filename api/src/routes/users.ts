import { Router } from 'express';
import { createHash } from 'crypto';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute } from '../lib/route-helpers';

const router = Router();

// Basic email shape check — we trust Auth0 has already validated, this is
// only to reject obvious garbage that would blow up the DB unique constraint
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/users/me
// Called once after Auth0 login to provision (or confirm) the user row.
// Idempotent — safe to call multiple times; upserts on auth0Id.
router.post(
  '/me',
  checkJwt,
  jwtErrorHandler,
  asyncRoute(async (req, res) => {
    const auth0Id = getAuth0Id(req);
    const { email } = req.body as { email?: unknown };

    if (email != null && (typeof email !== 'string' || !EMAIL_RE.test(email))) {
      res.status(400).json({
        error: 'valid email is required when email is provided',
        requestId: res.locals['requestId'] ?? 'unknown',
      });
      return;
    }

    const normalizedEmail = typeof email === 'string'
      ? email.trim().toLowerCase()
      : fallbackEmailForAuth0Id(auth0Id);

    const user = await prisma.user.upsert({
      where: { auth0Id },
      update: { email: normalizedEmail },
      create: { auth0Id, email: normalizedEmail },
    });

    res.json({ id: user.id, email: user.email });
  }),
);

export default router;

function fallbackEmailForAuth0Id(auth0Id: string): string {
  const digest = createHash('sha256').update(auth0Id).digest('hex').slice(0, 24);
  return `no-email+${digest}@users.tally.local`;
}

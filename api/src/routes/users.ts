import { Router } from 'express';
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

    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'valid email is required' });
      return;
    }

    const user = await prisma.user.upsert({
      where: { auth0Id },
      update: { email },
      create: { auth0Id, email },
    });

    res.json({ id: user.id, email: user.email });
  }),
);

export default router;

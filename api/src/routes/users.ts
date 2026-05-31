import { Router } from 'express';
import type { User } from '@prisma/client';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { asyncRoute } from '../lib/route-helpers';
import { fallbackEmailForAuth0Id, isFallbackEmail, normalizeUserEmail } from '../lib/user-email';
import { sendError } from '../lib/http-response';

const router = Router();

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
    const normalizedEmail = normalizeUserEmail(email);

    if (email != null && !normalizedEmail) {
      sendError(res, 400, 'valid email is required when email is provided');
      return;
    }

    const user = await provisionUser(auth0Id, normalizedEmail);

    res.json({ id: user.id, email: user.email });
  }),
);

export default router;

async function provisionUser(auth0Id: string, email: string | null): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { auth0Id } });
  if (existing) {
    if (email && isFallbackEmail(existing.email)) {
      return await updateEmailOrFallback(existing, email);
    }
    return existing;
  }

  return await createUserOrFallback(auth0Id, email ?? fallbackEmailForAuth0Id(auth0Id));
}

async function createUserOrFallback(auth0Id: string, email: string): Promise<User> {
  try {
    return await prisma.user.create({ data: { auth0Id, email } });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return await prisma.user.create({
      data: { auth0Id, email: fallbackEmailForAuth0Id(auth0Id) },
    });
  }
}

async function updateEmailOrFallback(existing: User, email: string): Promise<User> {
  try {
    return await prisma.user.update({
      where: { id: existing.id },
      data: { email },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    return existing;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
  );
}

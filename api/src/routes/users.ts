import { Router, Request, Response } from 'express';
import { checkJwt, getAuth0Id, jwtErrorHandler } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// POST /api/users/me
// Called once after Auth0 login to provision (or confirm) the user row.
// Safe to call multiple times — upsert on auth0Id.
router.post(
  '/me',
  checkJwt,
  jwtErrorHandler,
  async (req: Request, res: Response) => {
    try {
      const auth0Id = getAuth0Id(req);
      const { email } = req.body as { email?: string };

      if (!email) {
        res.status(400).json({ error: 'email is required' });
        return;
      }

      const user = await prisma.user.upsert({
        where: { auth0Id },
        update: { email },
        create: { auth0Id, email },
      });

      res.json(user);
    } catch (err) {
      console.error('POST /users/me error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

export default router;

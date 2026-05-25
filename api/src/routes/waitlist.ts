import { Router } from 'express';

const router = Router();

router.post('/', (_req, res) => {
  res.status(410).json({
    error: 'private alpha waitlist is currently closed',
    contactEmail: 'hello@tallypoints.app',
  });
});

export default router;

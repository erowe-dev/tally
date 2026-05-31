import { Router } from 'express';
import { responseRequestId } from '../lib/http-response';

const router = Router();

router.post('/', (_req, res) => {
  res.status(410).json({
    error: 'private alpha waitlist is currently closed',
    contactEmail: 'hello@tallypoints.app',
    requestId: responseRequestId(res),
  });
});

export default router;

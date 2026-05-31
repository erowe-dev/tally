import { Router } from 'express';
import { sendError } from '../lib/http-response';

const router = Router();

router.post('/', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  sendError(res, 410, 'private alpha waitlist is currently closed', 'waitlist_closed');
});

export default router;

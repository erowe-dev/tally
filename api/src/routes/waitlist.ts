import { Router } from 'express';
import { asyncRoute } from '../lib/route-helpers';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/',
  asyncRoute(async (req, res) => {
    const { email, source, pageUrl } = req.body as {
      email?: unknown;
      source?: unknown;
      pageUrl?: unknown;
    };

    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'valid email is required' });
      return;
    }

    const webhookUrl = process.env['WAITLIST_WEBHOOK_URL'];
    if (!webhookUrl || webhookUrl.trim() === '' || webhookUrl.startsWith('TODO_')) {
      res.status(503).json({
        error: 'waitlist webhook is not configured',
        fallbackEmail: 'hello@tallypoints.app',
      });
      return;
    }

    const payload = {
      email: email.trim().toLowerCase(),
      source: typeof source === 'string' ? source.slice(0, 80) : 'landing',
      pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 300) : undefined,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : undefined,
      signedUpAt: new Date().toISOString(),
    };

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const body = await webhookResponse.text();
      console.error('[waitlist] webhook failed:', webhookResponse.status, body.slice(0, 500));
      res.status(502).json({
        error: 'waitlist webhook failed',
        fallbackEmail: 'hello@tallypoints.app',
      });
      return;
    }

    res.status(202).json({ status: 'accepted' });
  }),
);

export default router;

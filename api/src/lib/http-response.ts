import type { Response } from 'express';

export function responseRequestId(res: Response): string {
  return typeof res.locals['requestId'] === 'string' ? res.locals['requestId'] : 'unknown';
}

export function sendError(res: Response, status: number, error: string): void {
  res.status(status).json({ error, requestId: responseRequestId(res) });
}

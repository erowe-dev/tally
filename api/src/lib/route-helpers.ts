import type { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma';
import { KNOWN_PROGRAM_ID_SET } from './program-ids';
import { responseRequestId, sendError } from './http-response';

/**
 * Shape of our custom errors — a plain Error with an HTTP status attached.
 */
export interface HttpError extends Error {
  status?: number;
  code?: string;
}

/**
 * Looks up the DB user for the authenticated Auth0 sub. Throws a typed 428 if
 * the user row hasn't been provisioned yet (client should call POST /api/users/me
 * before any other authenticated call; AuthService handles this automatically).
 */
export async function requireUser(auth0Id: string) {
  const user = await prisma.user.findUnique({ where: { auth0Id } });
  if (!user) {
    const err: HttpError = new Error('User not found — call POST /api/users/me first');
    err.status = 428;
    err.code = 'user_not_provisioned';
    throw err;
  }
  return user;
}

/**
 * Matches our program IDs (e.g. 'amex_mr', 'chase_ur', 'citi_ty').
 * Deliberately strict and allowlisted so unsupported IDs cannot drift into
 * wallet/expiry sync rows.
 */
const CARD_ID_RE = /^[a-z0-9_]{1,50}$/;

/**
 * Validates `:cardId` param. Use as a route-level middleware so each handler
 * can assume the param is safe.
 */
export function validateCardId(req: Request, res: Response, next: NextFunction): void {
  const { cardId } = req.params;
  if (!isKnownCardId(cardId)) {
    sendError(res, 400, 'Invalid cardId');
    return;
  }
  next();
}

export function isKnownCardId(cardId: string | undefined): cardId is string {
  return typeof cardId === 'string' && CARD_ID_RE.test(cardId) && KNOWN_PROGRAM_ID_SET.has(cardId);
}

/**
 * Wraps an async route handler so thrown errors become proper JSON responses
 * instead of hanging the request or leaking stack traces.
 */
export function asyncRoute(
  handler: (req: Request, res: Response) => Promise<void>,
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req, res);
    } catch (err: unknown) {
      const httpErr = err as HttpError;
      const status = httpErr.status ?? 500;
      // Only leak the message when it's one we set ourselves (status < 500)
      const message =
        status < 500 && httpErr.message
          ? httpErr.message
          : 'Internal server error';
      if (status >= 500) {
        console.error('[api] Unhandled error:', { requestId: responseRequestId(res), err });
      }
      sendError(res, status, message, httpErr.code);
    }
  };
}

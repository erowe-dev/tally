import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { Request, Response, NextFunction } from 'express';

const domain = process.env['AUTH0_DOMAIN'];
const audience = process.env['AUTH0_AUDIENCE'];

// env.ts runs before this module is used in practice, but guard anyway so a
// missing var produces a clear error instead of a cryptic JWKS failure
if (!domain || !audience) {
  throw new Error('AUTH0_DOMAIN and AUTH0_AUDIENCE must be set before importing auth middleware');
}

// Validates Auth0 JWT on every protected route
export const checkJwt = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${domain}/.well-known/jwks.json`,
  }) as jwksRsa.GetVerificationKey,
  audience,
  issuer: `https://${domain}/`,
  algorithms: ['RS256'],
});

// Extracts the Auth0 user ID (sub) from the validated JWT
export function getAuth0Id(req: Request): string {
  const auth = (req as Request & { auth?: { sub?: string } }).auth;
  if (!auth?.sub) throw new Error('No sub claim in JWT');
  return auth.sub;
}

// Returns 401 for bad/missing tokens instead of letting Express 500
export function jwtErrorHandler(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Invalid or missing token' });
    return;
  }
  next(err);
}

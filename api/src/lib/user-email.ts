import { createHash } from 'crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const FALLBACK_EMAIL_DOMAIN = '@users.tally.local';

export function normalizeUserEmail(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(normalized)) {
    return null;
  }

  return normalized;
}

export function fallbackEmailForAuth0Id(auth0Id: string): string {
  const digest = createHash('sha256').update(auth0Id).digest('hex').slice(0, 24);
  return `no-email+${digest}${FALLBACK_EMAIL_DOMAIN}`;
}

export function isFallbackEmail(email: string): boolean {
  return email.startsWith('no-email+') && email.endsWith(FALLBACK_EMAIL_DOMAIN);
}

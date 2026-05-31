const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'https://tally-theta-two.vercel.app',
  'https://tally.vercel.app',
  'https://tallypoints.app',
  'https://www.tallypoints.app',
] as const;

export function buildAllowedOrigins(configuredValue = process.env['APP_ORIGINS'] ?? ''): string[] {
  const configured = configuredValue
    .split(',')
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured])];
}

export function normalizeOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input) return null;

  try {
    const url = new URL(input);
    if (url.pathname !== '/' || url.search || url.hash) return null;
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

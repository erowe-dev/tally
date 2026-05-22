/**
 * Validates that every required environment variable is present at boot.
 * Fails loud rather than silently 500-ing on the first request.
 */
const REQUIRED = [
  'DATABASE_URL',
  'AUTH0_DOMAIN',
  'AUTH0_AUDIENCE',
] as const;

type RequiredVar = (typeof REQUIRED)[number];
type ResolvedEnv = Record<RequiredVar, string> & { DATABASE_URL_POOLED?: string };

export function validateEnv(): ResolvedEnv {
  const missing: string[] = [];
  const resolved = {} as ResolvedEnv;

  for (const key of REQUIRED) {
    const value = process.env[key];
    if (!value || value.trim() === '' || value.startsWith('TODO_')) {
      missing.push(key);
    } else {
      resolved[key] = value;
    }
  }

  const pooledUrl = process.env['DATABASE_URL_POOLED'];
  if (pooledUrl && pooledUrl.trim() !== '' && !pooledUrl.startsWith('TODO_')) {
    resolved.DATABASE_URL_POOLED = pooledUrl;
  } else if (process.env['NODE_ENV'] === 'production' || process.env['VERCEL'] === '1') {
    missing.push('DATABASE_URL_POOLED');
  }

  if (missing.length > 0) {
    // Print all missing vars in one message so the operator sees everything at once
    console.error(
      `\n[FATAL] Missing required environment variables:\n  - ${missing.join('\n  - ')}\n` +
        `\nCopy api/.env.example to api/.env and fill in the values.\n`,
    );
    process.exit(1);
  }

  return resolved;
}

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

export function validateEnv(): Record<RequiredVar, string> {
  const missing: string[] = [];
  const resolved = {} as Record<RequiredVar, string>;

  for (const key of REQUIRED) {
    const value = process.env[key];
    if (!value || value.trim() === '' || value.startsWith('TODO_')) {
      missing.push(key);
    } else {
      resolved[key] = value;
    }
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

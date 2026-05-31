const MAX_URL_INPUT_LENGTH = 500;

export function sanitizeClientUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const input = value.trim().slice(0, MAX_URL_INPUT_LENGTH);
  if (!input) return undefined;

  try {
    const url = new URL(input);
    return `${url.origin}${url.pathname}`;
  } catch {
    // Fall through to relative-path handling.
  }

  if (!input.startsWith('/')) return undefined;
  const pathOnly = input.split(/[?#]/, 1)[0];
  return pathOnly || undefined;
}

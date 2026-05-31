export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface FixedWindowRateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  maxBuckets?: number;
  now?: () => number;
}

export function createFixedWindowRateLimiter(options: FixedWindowRateLimiterOptions) {
  const buckets = new Map<string, RateLimitBucket>();
  const maxBuckets = options.maxBuckets ?? 500;
  const now = options.now ?? Date.now;

  return {
    hit(key: string): RateLimitResult {
      const currentTime = now();
      const current = buckets.get(key);
      const bucket = current && current.resetAt > currentTime
        ? current
        : { count: 0, resetAt: currentTime + options.windowMs };

      bucket.count += 1;
      buckets.set(key, bucket);

      if (buckets.size >= maxBuckets) {
        for (const [bucketKey, value] of buckets) {
          if (value.resetAt <= currentTime) buckets.delete(bucketKey);
        }
      }

      return {
        allowed: bucket.count <= options.maxRequests,
        limit: options.maxRequests,
        remaining: Math.max(0, options.maxRequests - bucket.count),
        resetAt: bucket.resetAt,
      };
    },
  };
}

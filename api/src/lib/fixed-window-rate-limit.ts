export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
  lastSeenAt: number;
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
        : { count: 0, resetAt: currentTime + options.windowMs, lastSeenAt: currentTime };

      bucket.count += 1;
      bucket.lastSeenAt = currentTime;
      buckets.set(key, bucket);

      if (buckets.size >= maxBuckets) {
        for (const [bucketKey, value] of buckets) {
          if (value.resetAt <= currentTime) buckets.delete(bucketKey);
        }
        while (buckets.size > maxBuckets) {
          const oldestKey = oldestBucketKey(buckets);
          if (!oldestKey || oldestKey === key) break;
          buckets.delete(oldestKey);
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

function oldestBucketKey(buckets: Map<string, RateLimitBucket>): string | null {
  let oldestKey: string | null = null;
  let oldestSeenAt = Infinity;

  for (const [key, bucket] of buckets) {
    if (bucket.lastSeenAt < oldestSeenAt) {
      oldestSeenAt = bucket.lastSeenAt;
      oldestKey = key;
    }
  }

  return oldestKey;
}

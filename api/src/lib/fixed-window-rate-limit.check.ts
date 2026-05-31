import { createFixedWindowRateLimiter } from './fixed-window-rate-limit';

let currentTime = 1_700_000_000_000;
const limiter = createFixedWindowRateLimiter({
  maxRequests: 3,
  windowMs: 60_000,
  now: () => currentTime,
});

const key = 'origin:ip:/api/telemetry/analytics';

assert(limiter.hit(key).allowed, 'first request should be allowed');
assert(limiter.hit(key).allowed, 'second request should be allowed');

const third = limiter.hit(key);
assert(third.allowed, 'third request should be allowed');
assert(third.remaining === 0, `expected zero remaining, got ${third.remaining}`);

const fourth = limiter.hit(key);
assert(!fourth.allowed, 'fourth request should be rate limited');
assert(fourth.limit === 3, `expected limit header value 3, got ${fourth.limit}`);
assert(fourth.remaining === 0, `expected zero remaining after limit, got ${fourth.remaining}`);

currentTime += 60_001;
const afterReset = limiter.hit(key);
assert(afterReset.allowed, 'request after reset window should be allowed');
assert(afterReset.remaining === 2, `expected reset remaining value 2, got ${afterReset.remaining}`);

currentTime = 1_800_000_000_000;
const cappedLimiter = createFixedWindowRateLimiter({
  maxRequests: 1,
  windowMs: 60_000,
  maxBuckets: 2,
  now: () => currentTime,
});

assert(cappedLimiter.hit('a').allowed, 'first capped bucket should be allowed');
currentTime += 1;
assert(cappedLimiter.hit('b').allowed, 'second capped bucket should be allowed');
currentTime += 1;
assert(cappedLimiter.hit('c').allowed, 'new capped bucket should be allowed after evicting the oldest bucket');

const retainedBucket = cappedLimiter.hit('b');
assert(!retainedBucket.allowed, 'recent capped bucket should retain its request count');

const evictedBucket = cappedLimiter.hit('a');
assert(evictedBucket.allowed, 'oldest capped bucket should have been evicted and recreated');

console.log('Fixed-window rate limiter check passed.');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

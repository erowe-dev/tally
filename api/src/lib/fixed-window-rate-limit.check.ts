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

console.log('Fixed-window rate limiter check passed.');

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

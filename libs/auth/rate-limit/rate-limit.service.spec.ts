import { RedisService } from '@libs/redis';
import { InMemoryRedis } from './in-memory-redis.fake';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService.consume', () => {
  const start = new Date('2026-11-14T12:00:00Z').getTime();
  const config = { windowMs: 60_000, maxAttempts: 2 };
  let redis: InMemoryRedis;
  let rateLimiter: RateLimitService;

  beforeEach(() => {
    jest.useFakeTimers({ now: start });
    redis = new InMemoryRedis();
    rateLimiter = new RateLimitService({
      getClient: () => redis,
    } as unknown as RedisService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows a request under the limit and reports what is left of the window', async () => {
    await expect(rateLimiter.consume('1.2.3.4', config)).resolves.toEqual({
      allowed: true,
      remaining: 1,
      resetAt: start + 60_000,
    });
  });

  it('blocks the request after the limit is spent', async () => {
    await rateLimiter.consume('1.2.3.4', config);
    await rateLimiter.consume('1.2.3.4', config);
    jest.advanceTimersByTime(10_000);

    await expect(rateLimiter.consume('1.2.3.4', config)).resolves.toEqual({
      allowed: false,
      remaining: 0,
      resetAt: start + 60_000,
    });
  });

  it('starts a fresh window once the old one ends', async () => {
    await rateLimiter.consume('1.2.3.4', config);
    await rateLimiter.consume('1.2.3.4', config);
    jest.advanceTimersByTime(60_000);

    await expect(rateLimiter.consume('1.2.3.4', config)).resolves.toEqual({
      allowed: true,
      remaining: 1,
      resetAt: start + 120_000,
    });
  });

  it('lets the request through when Redis fails', async () => {
    redis.failWith(new Error('connect ECONNREFUSED'));

    await expect(rateLimiter.consume('1.2.3.4', config)).resolves.toEqual({
      allowed: true,
      remaining: 2,
      resetAt: start + 60_000,
    });
  });
});

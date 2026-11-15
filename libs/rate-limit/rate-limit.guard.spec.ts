import { RedisService } from '@libs/redis';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InMemoryRedis } from './in-memory-redis.fake';
import { RateLimit } from './rate-limit.decorator';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

class SubmitController {
  @RateLimit({ windowMs: 60_000, maxAttempts: 1 })
  submit() {}
}

describe('RateLimitGuard', () => {
  const start = new Date('2026-11-14T12:00:00Z').getTime();
  let guard: RateLimitGuard;
  let headers: Map<string, unknown>;
  let context: ExecutionContext;

  beforeEach(() => {
    jest.useFakeTimers({ now: start });
    const redis = new InMemoryRedis();
    guard = new RateLimitGuard(
      new Reflector(),
      new RateLimitService({
        getClient: () => redis,
      } as unknown as RedisService),
    );
    headers = new Map();
    context = {
      getHandler: () => SubmitController.prototype.submit,
      switchToHttp: () => ({
        getRequest: () => ({ ip: '1.2.3.4', headers: {} }),
        getResponse: () => ({
          setHeader: (name: string, value: unknown) => headers.set(name, value),
        }),
      }),
    } as unknown as ExecutionContext;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sets the rate limit headers and answers 429 once the limit is spent', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(Object.fromEntries(headers)).toEqual({
      'X-RateLimit-Limit': 1,
      'X-RateLimit-Remaining': 0,
      'X-RateLimit-Reset': start + 60_000,
    });

    headers.clear();
    const blocked = await guard
      .canActivate(context)
      .catch((error: unknown) => error);

    expect(Object.fromEntries(headers)).toEqual({
      'X-RateLimit-Limit': 1,
      'X-RateLimit-Remaining': 0,
      'X-RateLimit-Reset': start + 60_000,
    });
    expect(blocked).toBeInstanceOf(HttpException);
    expect((blocked as HttpException).getStatus()).toBe(429);
    expect((blocked as HttpException).getResponse()).toMatchObject({
      message: 'Too many requests. Please try again in 1 minute',
    });
  });
});

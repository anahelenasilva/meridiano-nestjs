import { RateLimitService } from '@libs/rate-limit';
import { InMemoryRedis } from '@libs/rate-limit/in-memory-redis.fake';
import { RedisService } from '@libs/redis';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeedbackRateLimitGuard } from './feedback-rate-limit.guard';

describe('FeedbackRateLimitGuard', () => {
  let redis: InMemoryRedis;
  let guard: FeedbackRateLimitGuard;

  const contextFor = (request: object) =>
    ({
      getHandler: () => () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, ...request }),
        getResponse: () => ({ setHeader: () => undefined }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    redis = new InMemoryRedis();
    guard = new FeedbackRateLimitGuard(
      new Reflector(),
      new RateLimitService({
        getClient: () => redis,
      } as unknown as RedisService),
    );
  });

  it('counts an authenticated request against its user', async () => {
    await guard.canActivate(
      contextFor({ ip: '1.2.3.4', user: { id: 'user-1' } }),
    );

    expect(redis.keys()).toEqual(['rate_limit:feedback:user:user-1']);
  });

  it('counts a request without a user against its IP under the feedback prefix', async () => {
    await guard.canActivate(contextFor({ ip: '1.2.3.4' }));

    expect(redis.keys()).toEqual(['rate_limit:feedback:ip:1.2.3.4']);
  });
});

import { RedisService } from '@libs/redis';
import { Injectable, Logger } from '@nestjs/common';

export interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Epoch milliseconds when the current window ends. */
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(private readonly redisService: RedisService) {}

  /** Counts one request against `key` and reports whether it fits in the current window. */
  async consume(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    try {
      const { count, ttlMs } = await this.countRequest(
        `rate_limit:${key}`,
        config.windowMs,
      );
      return {
        allowed: count <= config.maxAttempts,
        remaining: Math.max(0, config.maxAttempts - count),
        resetAt: Date.now() + ttlMs,
      };
    } catch (error) {
      return this.allowWhileRedisIsDown(key, config, error);
    }
  }

  // One round trip. SET ... NX opens the window only on the first request and
  // INCR keeps the TTL, so the window never slides. Works on Redis < 7, unlike
  // PEXPIRE ... NX.
  private async countRequest(
    redisKey: string,
    windowMs: number,
  ): Promise<{ count: number; ttlMs: number }> {
    const replies = await this.redisService
      .getClient()
      .multi()
      .set(redisKey, 0, 'PX', windowMs, 'NX')
      .incr(redisKey)
      .pttl(redisKey)
      .exec();

    if (!replies) {
      throw new Error(`Rate limit transaction for ${redisKey} was aborted`);
    }
    const failed = replies.find(([error]) => error);
    if (failed?.[0]) {
      throw failed[0];
    }
    const [, [, count], [, ttlMs]] = replies;
    return { count: Number(count), ttlMs: Number(ttlMs) };
  }

  // A Redis outage should not lock everyone out of login, so the limiter
  // fails open and treats the request as the first in a fresh window.
  private allowWhileRedisIsDown(
    key: string,
    config: RateLimitConfig,
    error: unknown,
  ): RateLimitResult {
    this.logger.warn(
      `Redis error while rate limiting ${key}, allowing the request: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      allowed: true,
      remaining: config.maxAttempts,
      resetAt: Date.now() + config.windowMs,
    };
  }
}

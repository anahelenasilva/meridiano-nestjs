import { RedisService } from '@libs/redis';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Maximum attempts allowed in the window
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5, // 5 attempts
};

@Injectable()
export class RateLimitService {
  constructor(private readonly redisService: RedisService) { }

  async checkRateLimit(
    identifier: string,
    config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
  ): Promise<boolean> {
    const key = `rate_limit:${identifier}`;
    const client = this.redisService.getClient();

    try {
      const currentAttempts = await client.get(key);

      if (currentAttempts && parseInt(currentAttempts, 10) >= config.maxAttempts) {
        const ttl = await client.ttl(key);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Too many login attempts. Please try again in ${Math.ceil(ttl / 60)} minutes`,
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const attempts = await client.incr(key);

      if (attempts === 1) {
        await client.pexpire(key, config.windowMs);
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis fails, allow the request but log a warning
      console.warn('[RateLimitService] Redis error, allowing request:', error);
      return true;
    }
  }

  async resetRateLimit(identifier: string): Promise<void> {
    const key = `rate_limit:${identifier}`;
    const client = this.redisService.getClient();
    await client.del(key);
  }

  async getRemainingAttempts(
    identifier: string,
    config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG,
  ): Promise<number> {
    const key = `rate_limit:${identifier}`;
    const client = this.redisService.getClient();

    try {
      const currentAttempts = await client.get(key);
      if (!currentAttempts) {
        return config.maxAttempts;
      }
      return Math.max(0, config.maxAttempts - parseInt(currentAttempts, 10));
    } catch (error) {
      console.warn('[RateLimitService] Redis error:', error);
      return config.maxAttempts;
    }
  }
}

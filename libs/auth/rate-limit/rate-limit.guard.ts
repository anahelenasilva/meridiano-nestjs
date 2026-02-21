import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService, RateLimitConfig } from './rate-limit.service';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';
import { RateLimitOptions } from './rate-limit.types';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get rate limit options from decorator or use defaults
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    ) || {};

    const config: RateLimitConfig = {
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
      maxAttempts: options.maxAttempts || 5, // 5 attempts default
    };

    // Generate key from IP or provided key generator
    const key = options.keyGenerator
      ? options.keyGenerator(request)
      : request.ip || request.connection?.remoteAddress || 'unknown';

    try {
      await this.rateLimitService.checkRateLimit(key, config);

      // Add rate limit headers to response
      const remaining = await this.rateLimitService.getRemainingAttempts(key, config);
      response.setHeader('X-RateLimit-Limit', config.maxAttempts);
      response.setHeader('X-RateLimit-Remaining', remaining);
      response.setHeader('X-RateLimit-Reset', Date.now() + config.windowMs);

      return true;
    } catch (error) {
      // Add rate limit headers even on failure
      response.setHeader('X-RateLimit-Limit', config.maxAttempts);
      response.setHeader('X-RateLimit-Remaining', 0);
      throw error;
    }
  }
}

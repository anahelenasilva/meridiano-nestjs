import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';
import { RateLimitConfig, RateLimitService } from './rate-limit.service';
import { RateLimitOptions, RateLimitRequest } from './rate-limit.types';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const options =
      this.reflector.get<RateLimitOptions>(
        RATE_LIMIT_KEY,
        context.getHandler(),
      ) ?? {};
    const config: RateLimitConfig = {
      windowMs: options.windowMs || DEFAULT_WINDOW_MS,
      maxAttempts: options.maxAttempts || DEFAULT_MAX_ATTEMPTS,
    };

    const { allowed, remaining, resetAt } = await this.rateLimitService.consume(
      this.resolveKey(http.getRequest()),
      config,
    );

    const response = http.getResponse();
    response.setHeader('X-RateLimit-Limit', config.maxAttempts);
    response.setHeader('X-RateLimit-Remaining', remaining);
    response.setHeader('X-RateLimit-Reset', resetAt);

    if (!allowed) {
      const minutes = Math.max(1, Math.ceil((resetAt - Date.now()) / 60_000));
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many requests. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }

  /** The bucket a request counts against. Subclasses override it to bucket by something other than the caller's IP. */
  protected resolveKey(request: RateLimitRequest): string {
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }
}

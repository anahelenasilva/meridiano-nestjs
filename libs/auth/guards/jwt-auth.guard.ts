import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { timingSafeEqual } from 'crypto';
import { API_KEY_ALLOWED_KEY } from '../decorators/api-key-allowed.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const apiKeyAllowed = this.reflector.getAllAndOverride<boolean>(
      API_KEY_ALLOWED_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (apiKeyAllowed && this.hasValidApiKey(context)) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * True only when the request carries an `x-api-key` header that matches the
   * configured `MERIDIANO_API_KEY`. A missing/empty env value or an
   * absent/invalid header returns false, letting the caller fall through to the
   * JWT check — missing config is never treated as an open door.
   */
  private hasValidApiKey(context: ExecutionContext): boolean {
    const expectedKey = process.env.MERIDIANO_API_KEY;
    if (!expectedKey) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const headerValue = request.headers?.['x-api-key'];
    const providedKey =
      typeof headerValue === 'string'
        ? headerValue
        : Array.isArray(headerValue)
          ? headerValue[0]
          : undefined;

    if (!providedKey) {
      return false;
    }

    return this.constantTimeEqual(providedKey, expectedKey);
  }

  /**
   * Constant-time string comparison using crypto.timingSafeEqual.
   * Returns true only if the strings are exactly equal.
   *
   * A length mismatch short-circuits to false: timingSafeEqual requires
   * equal-length buffers, and length is not the secret here (the key is
   * fixed-length once configured). The timing-safe compare guards the
   * byte-by-byte path, where a leak would actually matter.
   */
  private constantTimeEqual(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, expectedBuffer);
  }
}

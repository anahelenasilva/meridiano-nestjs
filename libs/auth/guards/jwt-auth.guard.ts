import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { timingSafeEqual } from 'crypto';
import { ConfigService } from '../../../src/config/config.service';
import { API_KEY_ALLOWED_KEY } from '../decorators/api-key-allowed.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * The scoped static credential (`MERIDIANO_API_KEY`). Wraps the raw secret so
 * the guard passes a typed value around instead of a bare string, and owns the
 * constant-time comparison the credential must always be checked with.
 */
class ApiKeyCredential {
  private constructor(private readonly value: Buffer) {}

  /** The configured key, or null when `MERIDIANO_API_KEY` is unset/empty. */
  static from(configured: string | undefined): ApiKeyCredential | null {
    return configured ? new ApiKeyCredential(Buffer.from(configured)) : null;
  }

  /**
   * A length mismatch short-circuits to false: timingSafeEqual requires
   * equal-length buffers, and length is not the secret here (the key is
   * fixed-length once configured). The timing-safe compare guards the
   * byte-by-byte path, where a leak would actually matter.
   */
  matches(presented: string): boolean {
    const presentedBuffer = Buffer.from(presented);
    if (presentedBuffer.length !== this.value.length) {
      return false;
    }
    return timingSafeEqual(presentedBuffer, this.value);
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
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
    const credential = ApiKeyCredential.from(
      this.configService.getMeridianoApiKey(),
    );
    if (!credential) {
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

    return credential.matches(providedKey);
  }
}

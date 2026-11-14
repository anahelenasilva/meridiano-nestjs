import { RateLimitGuard } from '@libs/auth/rate-limit/rate-limit.guard';
import { RateLimitService } from '@libs/auth/rate-limit/rate-limit.service';
import { RateLimitRequest } from '@libs/auth/rate-limit/rate-limit.types';
import { StaticCredential } from '@libs/auth/static-credential';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '../../config/config.service';
import { EXTERNAL_TOKEN_HEADER } from './external-token.guard';

/**
 * Only a verified token gets its own bucket, keyed by its digest so the token
 * never appears in a Redis key. A missing or invented token counts against its
 * caller's IP, so sending a new guess each time cannot reset the allowance.
 */
@Injectable()
export class ExternalRateLimitGuard extends RateLimitGuard {
  constructor(
    reflector: Reflector,
    rateLimitService: RateLimitService,
    private readonly configService: ConfigService,
  ) {
    super(reflector, rateLimitService);
  }

  protected override resolveKey(request: RateLimitRequest): string {
    const digest = StaticCredential.from(
      this.configService.getExternalApiTokens(),
    ).verifiedDigest(request, EXTERNAL_TOKEN_HEADER);

    return digest
      ? `external:token:${digest}`
      : `external:ip:${super.resolveKey(request)}`;
  }
}

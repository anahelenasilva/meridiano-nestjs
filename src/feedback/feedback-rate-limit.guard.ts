import { RateLimitGuard, RateLimitRequest } from '@libs/rate-limit';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

export const FEEDBACK_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxAttempts: 5,
};

/**
 * Buckets by user, not IP, so users behind one NAT don't share an allowance,
 * and under a `feedback:` prefix so it never shares a bucket with login. The
 * global JWT guard runs before this one, so `user` is set on any request that
 * gets here; the IP fallback only covers a route wired without it.
 */
@Injectable()
export class FeedbackRateLimitGuard extends RateLimitGuard {
  protected override resolveKey(
    request: RateLimitRequest & { user?: AuthenticatedUser },
  ): string {
    return request.user?.id
      ? `feedback:user:${request.user.id}`
      : `feedback:ip:${super.resolveKey(request)}`;
  }
}

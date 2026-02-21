import { SetMetadata } from '@nestjs/common';
import { RateLimitOptions } from './rate-limit.types';

export const RATE_LIMIT_KEY = 'rate_limit';

export const RateLimit = (options: RateLimitOptions = {}) => {
  return SetMetadata(RATE_LIMIT_KEY, options);
};

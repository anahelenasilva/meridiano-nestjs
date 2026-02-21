export interface RateLimitOptions {
  windowMs?: number;
  maxAttempts?: number;
  keyGenerator?: (request: Request) => string;
}

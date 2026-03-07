export interface RateLimitRequest {
  headers: { [key: string]: string | string[] | undefined };
  ip?: string;
  connection?: { remoteAddress?: string };
  socket?: { remoteAddress?: string };
}

export interface RateLimitOptions {
  windowMs?: number;
  maxAttempts?: number;
  keyGenerator?: (request: RateLimitRequest) => string;
}

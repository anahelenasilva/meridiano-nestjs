import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ConfigService } from '../../config/config.service';

/**
 * Guard that validates external API tokens from X-External-Token header.
 * Tokens are configured via EXTERNAL_API_TOKENS environment variable (comma-separated).
 * Uses constant-time comparison to prevent timing attacks.
 */
@Injectable()
export class ExternalTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tokenHeader = request.headers['x-external-token'];
    const token = typeof tokenHeader === 'string'
      ? tokenHeader
      : Array.isArray(tokenHeader)
        ? tokenHeader[0]
        : undefined;

    if (!token || !token.trim()) {
      throw new UnauthorizedException('Missing X-External-Token header');
    }

    const validTokens = this.getValidTokens();

    if (!this.isTokenValid(token, validTokens)) {
      throw new UnauthorizedException('Invalid authentication token');
    }

    request.externalToken = token;

    return true;
  }

  /**
   * Constant-time token comparison to prevent timing attacks.
   * Uses crypto.timingSafeEqual for secure comparison.
   */
  private isTokenValid(token: string, validTokens: string[]): boolean {
    return validTokens.some(validToken => this.constantTimeCompare(token, validToken));
  }

  /**
   * Constant-time string comparison using crypto.timingSafeEqual.
   * Returns true only if strings are exactly equal.
   */
  private constantTimeCompare(a: string, b: string): boolean {
    // Convert strings to buffers for timing-safe comparison
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    
    // If lengths differ, use timingSafeEqual with same-length buffers
    // to maintain constant time
    if (aBuffer.length !== bBuffer.length) {
      const dummyBuffer = Buffer.alloc(aBuffer.length);
      try {
        timingSafeEqual(aBuffer, dummyBuffer);
      } catch {
        // Ignore - just maintaining constant time
      }
      return false;
    }

    try {
      return timingSafeEqual(aBuffer, bBuffer);
    } catch {
      return a === b;
    }
  }

  private getValidTokens(): string[] {
    return this.configService.getExternalApiTokens();
  }
}

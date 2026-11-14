import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '../../../src/config/config.service';
import { API_KEY_ALLOWED_KEY } from '../decorators/api-key-allowed.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { StaticCredential } from '../static-credential';

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
   * A missing or wrong `x-api-key`, or an unset `MERIDIANO_API_KEY`, falls
   * through to the JWT check: missing config is never an open door.
   */
  private hasValidApiKey(context: ExecutionContext): boolean {
    const credential = StaticCredential.from(
      this.configService.getMeridianoApiKey(),
    );
    return (
      credential.check(context.switchToHttp().getRequest(), 'x-api-key') ===
      'valid'
    );
  }
}

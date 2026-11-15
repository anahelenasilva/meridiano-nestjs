import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { StaticCredential } from '../../shared/helpers/static-credential';
import { ConfigService } from '../../config/config.service';

export const EXTERNAL_TOKEN_HEADER = 'x-external-token';

@Injectable()
export class ExternalTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const credential = StaticCredential.from(
      this.configService.getExternalApiTokens(),
    );

    switch (
      credential.check(
        context.switchToHttp().getRequest(),
        EXTERNAL_TOKEN_HEADER,
      )
    ) {
      case 'valid':
        return true;
      case 'missing':
        throw new UnauthorizedException('Missing X-External-Token header');
      case 'invalid':
        throw new UnauthorizedException('Invalid authentication token');
    }
  }
}

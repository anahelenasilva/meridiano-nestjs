import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { ExternalTokenGuard } from './external-token.guard';

describe('ExternalTokenGuard', () => {
  const configService = mock<ConfigService>();
  const guard = new ExternalTokenGuard(configService);

  const contextWith = (headers: Record<string, string>) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    configService.getExternalApiTokens.mockReturnValue([
      'valid-token-1',
      'valid-token-2',
    ]);
  });

  it('admits a request whose token matches a configured one', () => {
    expect(
      guard.canActivate(contextWith({ 'x-external-token': 'valid-token-2' })),
    ).toBe(true);
  });

  it('rejects a request without a token as missing', () => {
    expect(() => guard.canActivate(contextWith({}))).toThrow(
      new UnauthorizedException('Missing X-External-Token header'),
    );
  });

  it('rejects a request with an unknown token as invalid', () => {
    expect(() =>
      guard.canActivate(contextWith({ 'x-external-token': 'invented-token' })),
    ).toThrow(new UnauthorizedException('Invalid authentication token'));
  });
});

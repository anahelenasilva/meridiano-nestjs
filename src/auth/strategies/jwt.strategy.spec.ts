import { UnauthorizedException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { AuthService } from '../auth.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const authService = mock<AuthService>();
  const configService = mock<ConfigService>();
  configService.getJwtSecret.mockReturnValue('test-secret');
  const strategy = new JwtStrategy(authService, configService);

  it('puts only the user id on the request', async () => {
    authService.validateUser.mockResolvedValueOnce({
      id: 'user-1',
      email: 'ana@example.com',
      username: 'ana',
      isEmailVerified: true,
      created_at: new Date('2024-01-01'),
    });

    await expect(strategy.validate({ sub: 'user-1' })).resolves.toStrictEqual({
      id: 'user-1',
    });
  });

  it('rejects a token whose user no longer exists', async () => {
    authService.validateUser.mockResolvedValueOnce(null);

    await expect(strategy.validate({ sub: 'gone' })).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

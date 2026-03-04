import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ExternalTokenGuard } from './external-token.guard';
import { ConfigService } from '../../config/config.service';

describe('ExternalTokenGuard', () => {
  let guard: ExternalTokenGuard;
  let mockContext: ExecutionContext;
  let mockConfigService: jest.Mocked<ConfigService>;
  const originalEnv = process.env;

  beforeEach(() => {
    mockConfigService = {
      getExternalApiTokens: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;
    
    guard = new ExternalTokenGuard(mockConfigService);
    process.env = { ...originalEnv };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true for valid token', () => {
      mockConfigService.getExternalApiTokens.mockReturnValue(['valid-token-1', 'valid-token-2']);

      const request = {
        headers: {
          'x-external-token': 'valid-token-1',
        },
      };

      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      });

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(request['externalToken']).toBe('valid-token-1');
      expect(mockConfigService.getExternalApiTokens).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when token is missing', () => {
      mockConfigService.getExternalApiTokens.mockReturnValue(['valid-token']);

      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {},
        }),
      });

      expect(() => guard.canActivate(mockContext)).toThrow(
        new UnauthorizedException('Missing X-External-Token header'),
      );
    });

    it('should throw UnauthorizedException when token is invalid', () => {
      mockConfigService.getExternalApiTokens.mockReturnValue(['valid-token']);

      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            'x-external-token': 'invalid-token',
          },
        }),
      });

      expect(() => guard.canActivate(mockContext)).toThrow(
        new UnauthorizedException('Invalid authentication token'),
      );
    });

    it('should throw UnauthorizedException when no tokens are configured', () => {
      mockConfigService.getExternalApiTokens.mockReturnValue([]);

      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            'x-external-token': 'any-token',
          },
        }),
      });

      expect(() => guard.canActivate(mockContext)).toThrow(
        new UnauthorizedException('Invalid authentication token'),
      );
    });

    it('should handle tokens with whitespace', () => {
      mockConfigService.getExternalApiTokens.mockReturnValue(['token-with-spaces', 'another-token']);

      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            'x-external-token': 'token-with-spaces',
          },
        }),
      });

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should handle case where EXTERNAL_API_TOKENS is undefined', () => {
      mockConfigService.getExternalApiTokens.mockReturnValue([]);

      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          headers: {
            'x-external-token': 'any-token',
          },
        }),
      });

      expect(() => guard.canActivate(mockContext)).toThrow(
        new UnauthorizedException('Invalid authentication token'),
      );
    });

    it('should accept first token when header is an array', () => {
      mockConfigService.getExternalApiTokens.mockReturnValue(['valid-token-1', 'valid-token-2']);

      const request = {
        headers: {
          'x-external-token': ['valid-token-1', 'ignored-token'],
        },
      };

      mockContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(request),
      });

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
      expect(request['externalToken']).toBe('valid-token-1');
    });
  });
});

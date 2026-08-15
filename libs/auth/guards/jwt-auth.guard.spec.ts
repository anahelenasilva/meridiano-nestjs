import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../../src/config/config.service';
import { API_KEY_ALLOWED_KEY } from '../decorators/api-key-allowed.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const mockReflector = mock<Reflector>();
  const mockExecutionContext = mock<ExecutionContext>();
  const mockConfigService = mock<ConfigService>();

  /**
   * Wire the reflector so IS_PUBLIC_KEY / API_KEY_ALLOWED_KEY lookups resolve
   * independently of call order (the guard reads them in sequence).
   */
  const setMetadata = (metadata: {
    isPublic?: boolean;
    apiKeyAllowed?: boolean;
  }) => {
    mockReflector.getAllAndOverride.mockImplementation(((key: string) => {
      if (key === IS_PUBLIC_KEY) return metadata.isPublic ?? false;
      if (key === API_KEY_ALLOWED_KEY) return metadata.apiKeyAllowed ?? false;
      return undefined;
    }) as any);
  };

  const setRequestHeaders = (headers: Record<string, unknown>) => {
    mockExecutionContext.switchToHttp.mockReturnValue({
      getRequest: () => ({ headers }),
      getResponse: () => ({}),
      getNext: () => ({}),
    } as any);
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when route is marked as public', () => {
      const mockHandler = mock<(...args: unknown[]) => unknown>();
      const mockClass = class MockClass {};
      mockExecutionContext.getHandler.mockReturnValue(mockHandler as any);
      mockExecutionContext.getClass.mockReturnValue(mockClass);
      setMetadata({ isPublic: true });

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        [mockHandler, mockClass],
      );
    });

    it('should call super.canActivate when route is not public', () => {
      setMetadata({ isPublic: false });
      const superCanActivateSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue(true);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(superCanActivateSpy).toHaveBeenCalled();
    });
  });

  describe('canActivate with x-api-key', () => {
    let superCanActivateSpy: jest.SpyInstance;

    beforeEach(() => {
      superCanActivateSpy = jest
        .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
        .mockReturnValue('jwt-fallback' as any);
    });

    it('admits an api-key-allowed route with a matching x-api-key and no JWT', () => {
      mockConfigService.getMeridianoApiKey.mockReturnValue('secret-key');
      setMetadata({ apiKeyAllowed: true });
      setRequestHeaders({ 'x-api-key': 'secret-key' });

      expect(guard.canActivate(mockExecutionContext)).toBe(true);
      expect(superCanActivateSpy).not.toHaveBeenCalled();
    });

    it('falls through to JWT when the x-api-key is wrong', () => {
      mockConfigService.getMeridianoApiKey.mockReturnValue('secret-key');
      setMetadata({ apiKeyAllowed: true });
      setRequestHeaders({ 'x-api-key': 'wrong-key' });

      expect(guard.canActivate(mockExecutionContext)).toBe('jwt-fallback');
      expect(superCanActivateSpy).toHaveBeenCalled();
    });

    it('falls through to JWT when the x-api-key header is absent', () => {
      mockConfigService.getMeridianoApiKey.mockReturnValue('secret-key');
      setMetadata({ apiKeyAllowed: true });
      setRequestHeaders({});

      expect(guard.canActivate(mockExecutionContext)).toBe('jwt-fallback');
      expect(superCanActivateSpy).toHaveBeenCalled();
    });

    it('falls through to JWT when MERIDIANO_API_KEY is unset (key path inert)', () => {
      mockConfigService.getMeridianoApiKey.mockReturnValue(undefined);
      setMetadata({ apiKeyAllowed: true });
      setRequestHeaders({ 'x-api-key': 'anything' });

      expect(guard.canActivate(mockExecutionContext)).toBe('jwt-fallback');
      expect(superCanActivateSpy).toHaveBeenCalled();
    });

    it('falls through to JWT when MERIDIANO_API_KEY is empty', () => {
      mockConfigService.getMeridianoApiKey.mockReturnValue('');
      setMetadata({ apiKeyAllowed: true });
      setRequestHeaders({ 'x-api-key': '' });

      expect(guard.canActivate(mockExecutionContext)).toBe('jwt-fallback');
      expect(superCanActivateSpy).toHaveBeenCalled();
    });

    it('ignores a valid x-api-key on a route that is not api-key-allowed', () => {
      mockConfigService.getMeridianoApiKey.mockReturnValue('secret-key');
      setMetadata({ apiKeyAllowed: false });
      setRequestHeaders({ 'x-api-key': 'secret-key' });

      expect(guard.canActivate(mockExecutionContext)).toBe('jwt-fallback');
      expect(superCanActivateSpy).toHaveBeenCalled();
    });
  });
});

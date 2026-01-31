import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  const mockReflector = mock<Reflector>();
  const mockExecutionContext = mock<ExecutionContext>();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
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
      const mockClass = class MockClass { };
      mockExecutionContext.getHandler.mockReturnValue(mockHandler as any);
      mockExecutionContext.getClass.mockReturnValue(mockClass);
      mockReflector.getAllAndOverride.mockReturnValueOnce(true);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockHandler,
        mockClass,
      ]);
    });

    it('should call super.canActivate when route is not public', () => {
      mockReflector.getAllAndOverride.mockReturnValueOnce(false);
      const superCanActivateSpy = jest.spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate').mockReturnValue(true);

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(superCanActivateSpy).toHaveBeenCalled();
    });
  });
});

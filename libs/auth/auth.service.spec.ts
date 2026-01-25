import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { mock } from 'jest-mock-extended';
import { AuthService, USER_LOOKUP_PROVIDER_TOKEN } from './auth.service';
import type { UserLookupProvider } from './interfaces/user-lookup-provider.interface';
import { LoginResponseDto } from './dto/login-response.dto';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  const mockUserLookupProvider = mock<UserLookupProvider>();
  const mockJwtService = mock<JwtService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: USER_LOOKUP_PROVIDER_TOKEN,
          useValue: mockUserLookupProvider,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed-password';
      const user = {
        id: 'user-id',
        email,
        username: 'testuser',
        password: hashedPassword,
        created_at: new Date(),
      };

      mockUserLookupProvider.getUserByEmail.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockJwtService.sign.mockReturnValueOnce('jwt-token');

      const result = await service.login(email, password);

      expect(result).toBeInstanceOf(LoginResponseDto);
      expect(result.access_token).toBe('jwt-token');
      expect(result.user.email).toBe(email);
      expect(mockUserLookupProvider.getUserByEmail).toHaveBeenCalledWith(email, true);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: user.id, email });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      mockUserLookupProvider.getUserByEmail.mockResolvedValueOnce(null);

      await expect(service.login(email, password)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const user = {
        id: 'user-id',
        email,
        username: 'testuser',
        password: 'hashed-password',
        created_at: new Date(),
      };

      mockUserLookupProvider.getUserByEmail.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login(email, password)).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).toHaveBeenCalledWith(password, user.password);
    });
  });

  describe('validateUser', () => {
    it('should return user when found', async () => {
      const userId = 'user-id';
      const user = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        created_at: new Date(),
      };

      mockUserLookupProvider.getUserById.mockResolvedValueOnce(user);

      const result = await service.validateUser(userId);

      expect(result).toEqual(user);
      expect(mockUserLookupProvider.getUserById).toHaveBeenCalledWith(userId);
    });

    it('should return null when user not found', async () => {
      const userId = 'nonexistent-id';

      mockUserLookupProvider.getUserById.mockResolvedValueOnce(null);

      const result = await service.validateUser(userId);

      expect(result).toBeNull();
    });
  });
});

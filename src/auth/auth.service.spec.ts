import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { mock } from 'jest-mock-extended';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { LoginResponseDto } from './dto/login-response.dto';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  const mockUsersService = mock<UsersService>();
  const mockJwtService = mock<JwtService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
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
        isEmailVerified: true,
        created_at: new Date(),
      };

      mockUsersService.getUserByEmail.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
      mockJwtService.sign.mockReturnValueOnce('jwt-token');

      const result = await service.login(email, password);

      expect(result).toBeInstanceOf(LoginResponseDto);
      expect(result.access_token).toBe('jwt-token');
      expect(result.user.email).toBe(email);
      expect(mockUsersService.getUserByEmail).toHaveBeenCalledWith(email, true);
      expect(mockJwtService.sign).toHaveBeenCalledWith({ sub: user.id, email });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      mockUsersService.getUserByEmail.mockResolvedValueOnce(null);

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const user = {
        id: 'user-id',
        email,
        username: 'testuser',
        password: 'hashed-password',
        isEmailVerified: true,
        created_at: new Date(),
      };

      mockUsersService.getUserByEmail.mockResolvedValueOnce(user);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login(email, password)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(password, user.password);
    });

    it('should throw UnauthorizedException when email is not verified', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const user = {
        id: 'user-id',
        email,
        username: 'testuser',
        password: 'hashed-password',
        isEmailVerified: false,
        created_at: new Date(),
      };

      mockUsersService.getUserByEmail.mockResolvedValueOnce(user);

      await expect(service.login(email, password)).rejects.toThrow(
        'Please verify your email before logging in',
      );
    });
  });

  describe('validateUser', () => {
    it('should return user when found', async () => {
      const userId = 'user-id';
      const user = {
        id: userId,
        email: 'test@example.com',
        username: 'testuser',
        isEmailVerified: true,
        created_at: new Date(),
      };

      mockUsersService.getUserById.mockResolvedValueOnce(user);

      const result = await service.validateUser(userId);

      expect(result).toEqual(user);
      expect(mockUsersService.getUserById).toHaveBeenCalledWith(userId);
    });

    it('should return null when user not found', async () => {
      const userId = 'nonexistent-id';

      mockUsersService.getUserById.mockResolvedValueOnce(null);

      const result = await service.validateUser(userId);

      expect(result).toBeNull();
    });
  });
});

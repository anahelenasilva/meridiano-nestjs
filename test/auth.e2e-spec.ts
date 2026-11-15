import { RateLimitGuard } from '@libs/rate-limit';
import { DynamicModule, INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigService } from '../src/config/config.service';
import { User } from '../src/users/user.entity';
import { UsersModule } from '../src/users/users.module';
import { UsersService } from '../src/users/users.service';

// Test fixture data
const MOCK_USER_PASSWORD = 'TestPass123';
const MOCK_USER_HASHED_PASSWORD = bcrypt.hashSync(MOCK_USER_PASSWORD, 10);

const mockUser: User = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  username: 'testuser',
  password: MOCK_USER_HASHED_PASSWORD,
  isEmailVerified: true,
  created_at: new Date('2024-01-01'),
};

// User without password (for non-existent user scenarios)
const mockUserWithoutPassword: User = {
  ...mockUser,
  password: undefined,
  isEmailVerified: false,
};

const createMockUsersService = (): MockProxy<UsersService> => {
  const mockService = mock<UsersService>();
  mockService.getUserByEmail.mockImplementation(
    (email: string, includePassword?: boolean) => {
      if (email === mockUser.email) {
        if (includePassword) {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve({ ...mockUser, password: undefined });
      }
      return Promise.resolve(null); // User not found
    },
  );

  mockService.getUserById.mockImplementation((userId: string) => {
    if (userId === mockUser.id) {
      return Promise.resolve({ ...mockUser, password: undefined });
    }
    return Promise.resolve(null);
  });
  return mockService;
};

// JwtModule and RedisModule inject ConfigService without importing
// ConfigModule, since ConfigService is @Global() and AppModule registers it
// once. This stands in for that global registration.
@Module({})
class MockConfigModule {}

const buildMockConfigModule = (
  mockConfigService: MockProxy<ConfigService>,
): DynamicModule => ({
  module: MockConfigModule,
  global: true,
  providers: [{ provide: ConfigService, useValue: mockConfigService }],
  exports: [ConfigService],
});

// Replaces UsersModule so the test never loads DatabaseModule, which connects
// to Postgres and runs migrations on init.
@Module({})
class FakeUsersModule {}

const buildFakeUsersModule = (
  mockUsersService: MockProxy<UsersService>,
): DynamicModule => ({
  module: FakeUsersModule,
  providers: [{ provide: UsersService, useValue: mockUsersService }],
  exports: [UsersService],
});

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let mockUsersService: ReturnType<typeof createMockUsersService>;
  let originalJwtSecret: string | undefined;

  beforeAll(async () => {
    // Capture original JWT_SECRET before overriding
    originalJwtSecret = process.env.JWT_SECRET;

    // Set JWT_SECRET for testing
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';

    mockUsersService = createMockUsersService();

    const mockConfigService = mock<ConfigService>();
    mockConfigService.getJwtSecret.mockImplementation(() => {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error(
          'JWT_SECRET is required but not found in environment variables',
        );
      }
      return secret;
    });

    moduleFixture = await Test.createTestingModule({
      imports: [buildMockConfigModule(mockConfigService), AuthModule],
    })
      .overrideModule(UsersModule)
      .useModule(buildFakeUsersModule(mockUsersService))
      .overrideGuard(RateLimitGuard)
      .useValue({
        canActivate: () => true, // Bypass rate limiting in tests
      })
      .compile();

    app = moduleFixture.createNestApplication();

    // Configure ValidationPipe for DTO validation
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
    mockUsersService.getUserByEmail.mockClear();
    mockUsersService.getUserById.mockClear();
    jest.clearAllMocks();

    // Restore original JWT_SECRET or delete if it was undefined
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  describe('POST /api/auth/login', () => {
    it('should return 201 and JWT token for valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: mockUser.email,
          password: MOCK_USER_PASSWORD,
        })
        .expect(201);

      // Assert response structure
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');

      // Assert JWT format (header.payload.signature)
      const token = response.body.access_token;
      expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

      // Verify token signature and payload
      const jwtService = moduleFixture.get<JwtService>(JwtService);
      const verified = jwtService.verify<{
        sub: string;
        email: string;
        iat: number;
        exp: number;
      }>(token, {
        secret: process.env.JWT_SECRET,
      });
      expect(verified).toHaveProperty('sub', mockUser.id);
      expect(verified).toHaveProperty('email', mockUser.email);
      expect(verified).toHaveProperty('iat');
      expect(verified).toHaveProperty('exp');

      // Assert user data
      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
      });

      // Verify password is NOT included in response
      expect(response.body.user).not.toHaveProperty('password');

      // Verify the users service was called
      expect(mockUsersService.getUserByEmail).toHaveBeenCalledWith(
        mockUser.email,
        true, // includePassword should be true
      );
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: mockUser.email,
          password: 'WrongPassword123',
        })
        .expect(401);

      // Assert error response
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Failed to login');

      // Verify the users service was called
      expect(mockUsersService.getUserByEmail).toHaveBeenCalledWith(
        mockUser.email,
        true,
      );

      // Verify no token was issued
      expect(response.body).not.toHaveProperty('access_token');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123',
        })
        .expect(401);

      // Assert error response
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Failed to login');

      // Verify the users service was called
      expect(mockUsersService.getUserByEmail).toHaveBeenCalledWith(
        'nonexistent@example.com',
        true,
      );

      // Verify no token was issued
      expect(response.body).not.toHaveProperty('access_token');
    });

    it('should be accessible without authentication', async () => {
      // This verifies the @Public() decorator works correctly with the global JWT guard
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: mockUser.email,
          password: MOCK_USER_PASSWORD,
        })
        .expect(201);
    });

    it('should return 400 for missing email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          password: MOCK_USER_PASSWORD,
        })
        .expect(400);
    });

    it('should return 400 for missing password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: mockUser.email,
        })
        .expect(400);
    });

    it('should return 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: MOCK_USER_PASSWORD,
        })
        .expect(400);
    });

    it('should return 401 for user without password', async () => {
      // Temporarily override the mock to return user without password
      mockUsersService.getUserByEmail.mockResolvedValueOnce(
        mockUserWithoutPassword,
      );

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: mockUser.email,
          password: MOCK_USER_PASSWORD,
        })
        .expect(401);
    });
  });
});

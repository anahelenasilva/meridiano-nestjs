import { AuthModule as LibsAuthModule, USER_LOOKUP_PROVIDER_TOKEN } from '@libs/auth';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';

// Test fixture data
const MOCK_USER_PASSWORD = 'TestPass123';
const MOCK_USER_HASHED_PASSWORD = bcrypt.hashSync(MOCK_USER_PASSWORD, 10);

const mockUser = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  username: 'testuser',
  password: MOCK_USER_HASHED_PASSWORD,
  created_at: new Date('2024-01-01'),
};

// User without password (for non-existent user scenarios)
const mockUserWithoutPassword = {
  ...mockUser,
  password: undefined,
};

// Factory function for creating fresh mock instances
const createMockUserLookupProvider = () => ({
  getUserByEmail: jest.fn((email: string, includePassword: boolean) => {
    if (email === mockUser.email) {
      if (includePassword) {
        return Promise.resolve(mockUser);
      }
      return Promise.resolve({ ...mockUser, password: undefined });
    }
    return Promise.resolve(null); // User not found
  }),

  getUserById: jest.fn((userId: string) => {
    if (userId === mockUser.id) {
      return Promise.resolve({ ...mockUser, password: undefined });
    }
    return Promise.resolve(null);
  }),
});

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let mockUserLookupProvider: ReturnType<typeof createMockUserLookupProvider>;

  beforeAll(async () => {
    // Set JWT_SECRET for testing
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';

    // Create fresh mock instance
    mockUserLookupProvider = createMockUserLookupProvider();

    moduleFixture = await Test.createTestingModule({
      imports: [
        LibsAuthModule.forRoot({
          getUserByEmail: mockUserLookupProvider.getUserByEmail,
          getUserById: mockUserLookupProvider.getUserById,
        } as any),
      ],
      controllers: [AuthController],
    })
      .overrideProvider(USER_LOOKUP_PROVIDER_TOKEN)
      .useValue(mockUserLookupProvider)
      .compile();

    app = moduleFixture.createNestApplication();

    // Configure ValidationPipe for DTO validation
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
    mockUserLookupProvider.getUserByEmail.mockClear();
    mockUserLookupProvider.getUserById.mockClear();
    jest.clearAllMocks();
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

      // Decode and verify token payload
      const jwtService = moduleFixture.get<JwtService>(JwtService);
      const decoded = jwtService.decode(token);
      expect(decoded).toHaveProperty('sub', mockUser.id);
      expect(decoded).toHaveProperty('email', mockUser.email);
      expect(decoded).toHaveProperty('iat'); // issued at
      expect(decoded).toHaveProperty('exp'); // expiration

      // Assert user data
      expect(response.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
      });

      // Verify password is NOT included in response
      expect(response.body.user).not.toHaveProperty('password');

      // Verify the provider was called
      expect(mockUserLookupProvider.getUserByEmail).toHaveBeenCalledWith(
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

      // Verify the provider was called
      expect(mockUserLookupProvider.getUserByEmail).toHaveBeenCalledWith(
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

      // Verify the provider was called
      expect(mockUserLookupProvider.getUserByEmail).toHaveBeenCalledWith(
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
      mockUserLookupProvider.getUserByEmail.mockResolvedValueOnce(mockUserWithoutPassword);

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

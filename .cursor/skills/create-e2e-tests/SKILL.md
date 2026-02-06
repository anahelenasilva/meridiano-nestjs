---
name: create-e2e-tests
description: Creates e2e tests following project patterns and conventions. Use when creating e2e tests, writing e2e tests, adding e2e tests, or when the user mentions end-to-end testing.
---

# Create E2E Tests

## Quick Start

When creating e2e tests, follow this workflow:

1. Determine the feature/module to test
2. Create test file in [`test/`](test/) directory
3. Set up NestJS testing module with mocked providers
4. Configure lifecycle hooks ([`beforeAll`](test/auth.e2e-spec.ts:53), [`beforeEach`](test/auth.e2e-spec.ts:85), [`afterAll`](test/auth.e2e-spec.ts:89))
5. Write tests following Arrange-Act-Assert pattern
6. Use mock providers for external dependencies
7. Clean up mocks after each test

## File Location Pattern

Tests must be placed in the root [`test/`](test/) directory:

```
test/{feature}.e2e-spec.ts
```

- File name: `{feature}.e2e-spec.ts` (kebab-case with `.e2e-spec.ts` suffix)
- All e2e tests live in the root test directory, not nested in module directories

**Example locations:**
- [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts) - Authentication tests
- [`test/app.e2e-spec.ts`](test/app.e2e-spec.ts) - Application controller tests
- `test/articles.e2e-spec.ts` - Articles feature tests
- `test/users.e2e-spec.ts` - Users feature tests

## Jest Configuration

E2E tests use a separate Jest configuration file: [`test/jest-e2e.json`](test/jest-e2e.json)

Key configuration points:
- **testRegex**: `.e2e-spec.ts$` - Matches e2e test files
- **rootDir**: `.` - Root is the test directory
- **moduleNameMapper**: Maps `@libs/*` to `libs/*` for library imports
- **transformIgnorePatterns**: Handles ESM modules that need transformation

Run e2e tests with:
```bash
pnpm test:e2e
```

Run specific test file:
```bash
pnpm test:e2e -- auth.e2e-spec
```

## Required Imports Template

### Basic E2E Test Imports

```typescript
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
```

### Authentication Test Imports

```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthModule as LibsAuthModule, USER_LOOKUP_PROVIDER_TOKEN } from '@libs/auth';
```

### Library Imports

Use the `@libs/*` path alias for importing from the [`libs/`](libs/) directory:

```typescript
import { AuthModule, USER_LOOKUP_PROVIDER_TOKEN } from '@libs/auth';
import { DatabaseService } from '@libs/database';
import { QueueService } from '@libs/queue';
import { S3Service } from '@libs/s3';
```

## Setup Pattern (beforeAll)

### Simple Module Setup

For basic tests without authentication:

```typescript
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });
```

Reference: [`test/app.e2e-spec.ts`](test/app.e2e-spec.ts:11-18)

### Module Setup with Mocked Providers

For tests requiring mocked dependencies:

```typescript
describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let mockUserLookupProvider: ReturnType<typeof createMockUserLookupProvider>;

  beforeAll(async () => {
    // Set environment variables for testing
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
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:53-83)

**Key points:**
- Use `Test.createTestingModule()` from `@nestjs/testing`
- Import the module or controllers you want to test
- Use `.overrideProvider()` to replace real providers with mocks
- Configure global pipes (ValidationPipe) if needed for DTO validation
- Set environment variables before creating the module
- Call `await app.init()` to initialize the application

## Mock Provider Pattern

### Creating Mock Providers

Create factory functions for mock providers to ensure fresh instances:

```typescript
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
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:29-46)

### Test Fixture Data

Define mock data at the top of your test file:

```typescript
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
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:11-20)

## Lifecycle Hooks Pattern

### beforeAll

Set up the testing module and initialize the app:

```typescript
beforeAll(async () => {
  // Set environment variables
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';

  // Create mocks
  mockUserLookupProvider = createMockUserLookupProvider();

  // Create testing module
  moduleFixture = await Test.createTestingModule({
    imports: [/* modules */],
    controllers: [/* controllers */],
  })
    .overrideProvider(PROVIDER_TOKEN)
    .useValue(mockProvider)
    .compile();

  app = moduleFixture.createNestApplication();
  await app.init();
});
```

### beforeEach

Clear mocks before each test:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:85-87)

### afterAll

Close the app and module, and clean up mocks:

```typescript
afterAll(async () => {
  await app.close();
  await moduleFixture.close();
  mockUserLookupProvider.getUserByEmail.mockClear();
  mockUserLookupProvider.getUserById.mockClear();
  jest.clearAllMocks();
});
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:89-95)

### afterEach (for async cleanup)

For tests with async operations (like BullMQ workers), add a delay before closing:

```typescript
afterEach(async () => {
  // Add a small delay to let BullMQ workers settle before closing
  // This prevents ECONNRESET/EPIPE errors during test teardown
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (app) {
    await app.close();
  }
});
```

Reference: [`test/app.e2e-spec.ts`](test/app.e2e-spec.ts:20-28)

## Test Structure Pattern

Follow Arrange-Act-Assert pattern:

```typescript
it('should return 201 and JWT token for valid credentials', async () => {
  // Act: Make HTTP request
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: mockUser.email,
      password: MOCK_USER_PASSWORD,
    })
    .expect(201);

  // Assert: Verify response structure
  expect(response.body).toHaveProperty('access_token');
  expect(response.body).toHaveProperty('user');

  // Assert: JWT format (header.payload.signature)
  const token = response.body.access_token;
  expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

  // Assert: Decode and verify token payload
  const jwtService = moduleFixture.get<JwtService>(JwtService);
  const decoded = jwtService.decode(token);
  expect(decoded).toHaveProperty('sub', mockUser.id);
  expect(decoded).toHaveProperty('email', mockUser.email);

  // Assert: User data
  expect(response.body.user).toEqual({
    id: mockUser.id,
    email: mockUser.email,
    username: mockUser.username,
  });

  // Verify password is NOT included in response
  expect(response.body.user).not.toHaveProperty('password');
});
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:98-138)

**Best practices:**
- Use `describe` blocks to organize related tests
- Use `request(app.getHttpServer())` for HTTP requests
- Chain `.expect(statusCode)` for status code assertions
- Use `expect().toHaveProperty()` for property existence checks
- Use `expect().toEqual()` for exact object matching
- Use `expect().toMatchObject()` for partial object matching
- Use `expect().not.toHaveProperty()` to verify sensitive data is excluded

## HTTP Request Patterns

### GET Request

```typescript
const response = await request(app.getHttpServer())
  .get('/')
  .expect(200)
  .expect('Hello World!');
```

Reference: [`test/app.e2e-spec.ts`](test/app.e2e-spec.ts:31-34)

### POST Request with Body

```typescript
const response = await request(app.getHttpServer())
  .post('/api/auth/login')
  .send({
    email: mockUser.email,
    password: MOCK_USER_PASSWORD,
  })
  .expect(201);
```

### POST Request with Authentication

```typescript
const response = await request(app.getHttpServer())
  .post('/api/resource')
  .set('Authorization', `Bearer ${token}`)
  .send({ data: 'value' })
  .expect(201);
```

### Testing Public Endpoints

Verify that public endpoints work without authentication:

```typescript
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
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:186-195)

## Validation Testing Pattern

### Testing Missing Required Fields

```typescript
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
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:197-213)

### Testing Invalid Input Format

```typescript
it('should return 400 for invalid email format', async () => {
  await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: 'not-an-email',
      password: MOCK_USER_PASSWORD,
    })
    .expect(400);
});
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:215-223)

## Error Case Testing Pattern

### Testing Unauthorized Access

```typescript
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

  // Verify no token was issued
  expect(response.body).not.toHaveProperty('access_token');
});
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:140-161)

### Testing Not Found

```typescript
it('should return 401 for non-existent user', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: 'nonexistent@example.com',
      password: 'SomePassword123',
    })
    .expect(401);

  expect(response.body).toHaveProperty('message');
  expect(response.body.message).toBe('Failed to login');
});
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:163-184)

## Mock Overriding Pattern

### Temporarily Override Mock Behavior

For specific test cases, you can temporarily override mock behavior:

```typescript
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
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:225-236)

**Key points:**
- Use `.mockResolvedValueOnce()` for one-time mock override
- The override only affects the next call
- Subsequent calls use the original mock implementation

## Verifying Mock Calls

### Verify Provider Was Called

```typescript
// Verify the provider was called with correct arguments
expect(mockUserLookupProvider.getUserByEmail).toHaveBeenCalledWith(
  mockUser.email,
  true, // includePassword should be true
);
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:134-137)

### Verify Call Count

```typescript
expect(mockUserLookupProvider.getUserByEmail).toHaveBeenCalledTimes(1);
```

## JWT Testing Pattern

### Decoding and Verifying JWT Tokens

```typescript
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
```

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts:112-121)

## Examples

### Example 1: Simple GET Request Test

Reference: [`test/app.e2e-spec.ts`](test/app.e2e-spec.ts)

```typescript
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;

  beforeEach(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
```

### Example 2: Authentication Test with Mocked Providers

Reference: [`test/auth.e2e-spec.ts`](test/auth.e2e-spec.ts)

```typescript
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

// Factory function for creating fresh mock instances
const createMockUserLookupProvider = () => ({
  getUserByEmail: jest.fn((email: string, includePassword: boolean) => {
    if (email === mockUser.email) {
      if (includePassword) {
        return Promise.resolve(mockUser);
      }
      return Promise.resolve({ ...mockUser, password: undefined });
    }
    return Promise.resolve(null);
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
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';
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

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');

      const token = response.body.access_token;
      expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

      const jwtService = moduleFixture.get<JwtService>(JwtService);
      const decoded = jwtService.decode(token);
      expect(decoded).toHaveProperty('sub', mockUser.id);
      expect(decoded).toHaveProperty('email', mockUser.email);

      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: mockUser.email,
          password: 'WrongPassword123',
        })
        .expect(401);

      expect(response.body.message).toBe('Failed to login');
      expect(response.body).not.toHaveProperty('access_token');
    });
  });
});
```

## Common Patterns

### Using Mock Providers

```typescript
const mockProvider = {
  method: jest.fn().mockResolvedValue(mockData),
};

moduleFixture = await Test.createTestingModule({
  imports: [ModuleToTest],
})
  .overrideProvider(PROVIDER_TOKEN)
  .useValue(mockProvider)
  .compile();
```

### Setting Environment Variables

```typescript
beforeAll(async () => {
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
  // ... rest of setup
});
```

### Configuring Global Pipes

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

### Testing Error Responses

```typescript
expect(res.status).toBe(HttpStatus.NOT_FOUND);
expect(res.status).toBe(HttpStatus.BAD_REQUEST);
expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
```

Use `HttpStatus` enum from `@nestjs/common` for status codes.

## Anti-Patterns to Avoid

**Don't forget to clear mocks:**
- Always call `jest.clearAllMocks()` in `beforeEach` or `afterAll`
- Clear specific mocks with `.mockClear()` if needed

**Don't forget to close resources:**
- Always close app and module in `afterAll`
- For async operations, add a delay before closing (see [`test/app.e2e-spec.ts`](test/app.e2e-spec.ts:20-28))

**Don't hardcode sensitive data:**
- Use environment variables for secrets
- Use mock data for test fixtures

**Don't skip validation testing:**
- Test missing required fields
- Test invalid input formats
- Test boundary conditions

**Don't forget to test error cases:**
- Test unauthorized access
- Test not found scenarios
- Test validation failures

**Don't mix test data:**
- Each test should be independent
- Clear mocks between tests
- Use factory functions for fresh mock instances

**Don't forget to verify mock calls:**
- Use `expect().toHaveBeenCalledWith()` to verify arguments
- Use `expect().toHaveBeenCalledTimes()` to verify call count

## Project-Specific Notes

### Library Structure

This project uses a [`libs/`](libs/) directory for shared libraries:
- [`@libs/auth`](libs/auth/) - Authentication module
- [`@libs/database`](libs/database/) - Database service
- [`@libs/email`](libs/email/) - Email service
- [`@libs/queue`](libs/queue/) - Queue service (BullMQ)
- [`@libs/redis`](libs/redis/) - Redis service
- [`@libs/s3`](libs/s3/) - S3 service

Import these using the `@libs/*` path alias.

### Test Configuration

- E2E tests are in [`test/`](test/) directory
- Jest config: [`test/jest-e2e.json`](test/jest-e2e.json)
- Run with: `pnpm test:e2e`

### Module Patterns

- Use `.forRoot()` for dynamic modules (e.g., [`LibsAuthModule.forRoot()`](test/auth.e2e-spec.ts:62))
- Override providers with `.overrideProvider().useValue()`
- Configure global pipes after creating the app

### Async Cleanup

For tests involving BullMQ or other async operations, add a delay before closing:

```typescript
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (app) {
    await app.close();
  }
});
```

This prevents ECONNRESET/EPIPE errors during test teardown.

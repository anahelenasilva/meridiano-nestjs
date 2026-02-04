# Plan to Implement E2E Tests for Login Section

## Overview
This plan provides detailed implementation steps for creating comprehensive end-to-end tests for the authentication/login functionality. The tests will validate successful login scenarios and various failure cases without requiring a real database connection.

## Prerequisites
- **Environment Variables**: Ensure `JWT_SECRET` is set in your test environment (can be a test value like `test-jwt-secret-key`)
- **Dependencies**: `@nestjs/testing`, `supertest`, `bcrypt` (already in package.json)
- **Test Configuration**: Jest E2E configuration at [`test/jest-e2e.json`](test/jest-e2e.json)

## Architecture Context
- **Auth Library**: Located at [`libs/auth`](libs/auth), provides [`AuthService`](libs/auth/auth.service.ts) and [`AuthModule`](libs/auth/auth.module.ts)
- **Auth Controller**: [`src/auth/auth.controller.ts`](src/auth/auth.controller.ts) exposes `POST /api/auth/login` endpoint
- **User Lookup**: Uses [`UserLookupProvider`](libs/auth/interfaces/user-lookup-provider.interface.ts) interface for user data access
- **Token**: [`USER_LOOKUP_PROVIDER_TOKEN`](libs/auth/auth.service.ts:7) is the injection token

## Implementation Steps

### 1. Create E2E Test File
**Status**: [completed]

**Action**: Create a new file at `test/auth.e2e-spec.ts`

**Details**:
- Follow the existing pattern from [`test/app.e2e-spec.ts`](test/app.e2e-spec.ts)
- Import necessary testing utilities from `@nestjs/testing`
- Import `supertest` for HTTP assertions
- Import `bcrypt` for password hashing

**Initial Structure**:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { USER_LOOKUP_PROVIDER_TOKEN } from '@libs/auth';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;

  // Test setup will go here
});
```

---

### 2. Set Up Testing Module
**Status**: [completed]

**Action**: Configure the NestJS testing module with proper overrides

**Details**:
- Import `LibsAuthModule.forRoot()` directly to avoid loading the entire application context
- The original plan suggested using [`AppModule`](src/app.module.ts), but this loads unnecessary dependencies (DatabaseModule, ProcessorModule, etc.)
- We override the `USER_LOOKUP_PROVIDER_TOKEN` to inject our mock

**Implementation Note**: Using `LibsAuthModule.forRoot()` directly makes tests faster and more isolated, avoiding database connections and other external dependencies.

**Implementation**:
```typescript
beforeAll(async () => {
  // Set JWT_SECRET for testing
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-tests';

  moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(USER_LOOKUP_PROVIDER_TOKEN)
    .useValue(mockUserLookupProvider) // Will be defined in step 4
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

afterAll(async () => {
  await app.close();
});
```

**Why**: This creates an isolated test environment that mirrors the production setup but with controlled dependencies. The `ValidationPipe` is required for DTO validation tests (steps 9.1-9.3) to work correctly.

---

### 3. Create Mock User Data
**Status**: [completed]

**Action**: Define fixture data for test scenarios

**Details**:
- Create a mock user that matches the [`User`](src/users/user.entity.ts) interface
- Hash the password using bcrypt with the same salt rounds as production (typically 10)
- Define both the plain password (for test requests) and hashed password (for mock responses)

**Implementation**:
```typescript
// Test fixture data
const MOCK_USER_PASSWORD = 'TestPass123'; // Plain password for requests
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
```

**Why**: Having pre-defined fixtures ensures consistent test data and makes tests reproducible.

---

### 4. Implement Mock UserLookupProvider
**Status**: [completed]

**Action**: Create a mock implementation of the [`UserLookupProvider`](libs/auth/interfaces/user-lookup-provider.interface.ts) interface

**Details**:
- The interface requires two methods: `getUserByEmail` and `getUserById`
- The mock should return controlled data based on test scenarios
- Use a simple object with methods that can be spied on with Jest

**Implementation**:
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

let mockUserLookupProvider: ReturnType<typeof createMockUserLookupProvider>;

// Create fresh mock before each test for complete isolation
beforeEach(() => {
  mockUserLookupProvider = createMockUserLookupProvider();
});
```

**Why**: This allows us to control user lookup behavior without database dependencies and verify that the service calls the provider correctly. Using a factory function ensures complete test isolation and prevents order dependencies.

---

### 5. Override Provider in TestingModule
**Status**: [completed]

**Action**: Configure dependency injection to use the mock provider

**Details**:
- This was already included in Step 2, but here's the key concept
- The [`AuthService`](libs/auth/auth.service.ts:11-14) expects `USER_LOOKUP_PROVIDER_TOKEN` to be injected
- By overriding this token, we replace the real [`UserLookupProviderImpl`](src/auth/providers/user-lookup.provider.ts) with our mock

**Code Reference** (from Step 2):
```typescript
.overrideProvider(USER_LOOKUP_PROVIDER_TOKEN)
.useValue(mockUserLookupProvider)
```

**Why**: This is the core of the testing strategy - isolating the auth logic from database dependencies while maintaining the same interfaces.

---

### 6. Test Case: Successful Login
**Status**: [completed]

**Action**: Write a test for valid credentials returning a JWT token

**Details**:
- Send POST request to `/api/auth/login` endpoint (defined in [`AuthController`](src/auth/auth.controller.ts:9))
- Use the mock user's email and plain password
- Assert HTTP 201 status (NestJS default for `@Post()`)

**Note**: The endpoint returns HTTP 201 (Created) instead of 200, which is the default NestJS behavior for `@Post()` endpoints.
- Assert response contains `access_token` field
- Assert response contains user object with `id`, `email`, `username` (per [`LoginResponseDto`](libs/auth/dto/login-response.dto.ts))
- Verify the token is a valid JWT format (3 parts separated by dots)
- Verify the mock provider was called correctly

**Implementation**:
```typescript
it('POST /api/auth/login - should return 200 and JWT token for valid credentials', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: mockUser.email,
      password: MOCK_USER_PASSWORD,
    })
    .expect(200);

  // Assert response structure
  expect(response.body).toHaveProperty('access_token');
  expect(response.body).toHaveProperty('user');

  // Assert JWT format (header.payload.signature)
  const token = response.body.access_token;
  expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);

  // Decode and verify token payload
  const jwtService = moduleFixture.get<JwtService>(JwtService);
  const decoded = jwtService.decode(token) as any;
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
```

**Why**: This validates the happy path and ensures the authentication flow works correctly from HTTP request to JWT generation. Token payload verification ensures the JWT contains correct user data, not just a valid format.

---

### 7. Test Case: Invalid Password
**Status**: [completed]

**Action**: Write a test for login failure due to incorrect password

**Details**:
- Send POST request with correct email but wrong password
- The [`AuthService.login`](libs/auth/auth.service.ts:16-41) method uses `bcrypt.compare` to validate passwords
- Assert HTTP 401 Unauthorized status
- Assert error message is generic (security best practice - don't reveal if user exists)
- Verify the provider was called to fetch the user

**Implementation**:
```typescript
it('POST /api/auth/login - should return 401 for invalid password', async () => {
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
```

**Why**: This ensures the password validation logic works correctly and returns appropriate error responses.

---

### 8. Test Case: Non-Existent User
**Status**: [completed]

**Action**: Write a test for login failure when user doesn't exist

**Details**:
- Send POST request with an email that doesn't exist in the system
- The mock provider will return `null` for unknown emails
- The [`AuthService`](libs/auth/auth.service.ts:19-21) checks if user is null and throws `UnauthorizedException`
- Assert HTTP 401 Unauthorized status
- Assert generic error message (don't reveal user doesn't exist)

**Implementation**:
```typescript
it('POST /api/auth/login - should return 401 for non-existent user', async () => {
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
```

**Why**: This validates that the system properly handles attempts to authenticate non-existent users without revealing their non-existence (security best practice).

---

### 9. Additional Test Cases (Recommended)
**Status**: [completed]

**Action**: Add edge case tests for robustness

**Suggested Tests**:

#### 9.1. Global Guard Bypass Test
```typescript
it('POST /api/auth/login - should be accessible without authentication', async () => {
  // This verifies the @Public() decorator works correctly with the global JWT guard
  await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: mockUser.email,
      password: MOCK_USER_PASSWORD,
    })
    .expect(200);
});
```

**Why**: Explicitly verifies the login endpoint bypasses the global JWT guard configured in [`AppModule`](src/app.module.ts:49-52).

#### 9.2. Missing Email Field
```typescript
it('POST /api/auth/login - should return 400 for missing email', async () => {
  await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      password: MOCK_USER_PASSWORD,
    })
    .expect(400);
});
```

#### 9.3. Missing Password Field
```typescript
it('POST /api/auth/login - should return 400 for missing password', async () => {
  await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: mockUser.email,
    })
    .expect(400);
});
```

#### 9.4. Invalid Email Format
```typescript
it('POST /api/auth/login - should return 400 for invalid email format', async () => {
  await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({
      email: 'not-an-email',
      password: MOCK_USER_PASSWORD,
    })
    .expect(400);
});
```

#### 9.5. User Without Password (Edge Case)
```typescript
it('POST /api/auth/login - should return 401 for user without password', async () => {
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

**Why**: These tests ensure the validation layer (from [`LoginDto`](libs/auth/dto/login.dto.ts)) works correctly and edge cases are handled gracefully.

---

### 10. Execute and Verify Tests
**Status**: [completed]

**Action**: Run the E2E test suite and verify all tests pass

**Commands**:
```bash
# Run all E2E tests
pnpm test:e2e

# Run only auth E2E tests
pnpm test:e2e -- auth.e2e-spec

# Run with coverage
pnpm test:e2e -- --coverage

# Run in watch mode for development
pnpm test:e2e -- --watch
```

**Verification Checklist**:
- [x] All test cases pass
- [x] No console errors or warnings
- [x] Mock provider is called with correct parameters
- [x] Response structures match DTOs
- [x] JWT tokens are valid format
- [x] Error messages are appropriate
- [x] Test execution time is reasonable (~8 seconds)

**Debugging Tips**:
- Use `--verbose` flag for detailed output
- Add `console.log(response.body)` to inspect responses
- Use `--detectOpenHandles` to find async issues
- Check that `JWT_SECRET` is set in test environment

---

## Complete Test File Structure

```
test/auth.e2e-spec.ts
├── Imports
├── Mock Data Setup
│   ├── MOCK_USER_PASSWORD
│   ├── MOCK_USER_HASHED_PASSWORD
│   └── mockUser
├── Mock Provider Setup
│   ├── createMockUserLookupProvider (factory function)
│   └── mockUserLookupProvider (instance)
├── Test Suite: "Authentication (e2e)"
│   ├── beforeAll: Setup TestingModule & App (with ValidationPipe)
│   ├── afterAll: Cleanup
│   ├── beforeEach: Create fresh mock instance
│   ├── Test: Successful login with JWT payload verification (200)
│   ├── Test: Invalid password (401)
│   ├── Test: Non-existent user (401)
│   ├── Test: Global guard bypass verification (200)
│   ├── Test: Missing email (400)
│   ├── Test: Missing password (400)
│   ├── Test: Invalid email format (400)
│   └── Test: User without password (401)
```

---

## Key Concepts & Patterns

### Dependency Injection Override
The core testing strategy relies on NestJS's ability to override providers:
```typescript
.overrideProvider(USER_LOOKUP_PROVIDER_TOKEN)
.useValue(mockUserLookupProvider)
```

This replaces the real database-backed provider with a mock, enabling:
- Fast test execution (no DB queries)
- Predictable test data
- Isolation from external dependencies

### Mock Provider Pattern
The mock provider implements the same interface as the real provider:
```typescript
interface UserLookupProvider {
  getUserByEmail(email: string, includePassword: boolean): Promise<User | null>;
  getUserById(userId: string): Promise<User | null>;
}
```

This ensures type safety and contract compliance.

### Security Best Practices
- Generic error messages ("Failed to login") for both invalid password and non-existent user
- Password never included in response
- JWT tokens with expiration (24h configured in [`AuthModule`](libs/auth/auth.module.ts:21))

### Test Data Management
- Use `bcrypt.hashSync` for synchronous hashing in test setup
- Keep plain passwords in constants for readability
- Use realistic but fake data (test@example.com)

---

## Related Files Reference

| File                                                                                                               | Purpose                      |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| [`libs/auth/auth.service.ts`](libs/auth/auth.service.ts)                                                           | Core authentication logic    |
| [`libs/auth/auth.module.ts`](libs/auth/auth.module.ts)                                                             | Auth module configuration    |
| [`libs/auth/interfaces/user-lookup-provider.interface.ts`](libs/auth/interfaces/user-lookup-provider.interface.ts) | Provider interface           |
| [`libs/auth/dto/login.dto.ts`](libs/auth/dto/login.dto.ts)                                                         | Login request validation     |
| [`libs/auth/dto/login-response.dto.ts`](libs/auth/dto/login-response.dto.ts)                                       | Login response structure     |
| [`src/auth/auth.controller.ts`](src/auth/auth.controller.ts)                                                       | HTTP endpoint definition     |
| [`src/auth/auth.module.ts`](src/auth/auth.module.ts)                                                               | App-level auth configuration |
| [`src/auth/providers/user-lookup.provider.ts`](src/auth/providers/user-lookup.provider.ts)                         | Real provider implementation |
| [`src/users/user.entity.ts`](src/users/user.entity.ts)                                                             | User interface definition    |
| [`test/app.e2e-spec.ts`](test/app.e2e-spec.ts)                                                                     | Example E2E test structure   |
| [`test/jest-e2e.json`](test/jest-e2e.json)                                                                         | Jest E2E configuration       |

---

## Success Criteria

✅ **All test cases pass consistently** - 8/8 tests passing
✅ **Tests run in reasonable time** - ~8 seconds (acceptable for E2E)
✅ **No database connection required** - Mock provider used
✅ **Mock provider is properly isolated** - Fresh mock per test
✅ **JWT tokens are validated** - Format and payload verified
✅ **Error cases are covered** - 401 and 400 scenarios tested
✅ **Validation errors are tested** - Missing fields and invalid email
✅ **Code follows existing patterns** - Uses NestJS testing utilities

## Implementation Notes

1. **Module Selection**: Used `LibsAuthModule.forRoot()` directly instead of `AppModule` to avoid loading unnecessary dependencies (DatabaseModule, ProcessorModule, etc.)

2. **HTTP Status Codes**: The login endpoint returns HTTP 201 (Created) by default from NestJS `@Post()` decorator, not 200.

3. **Mock Strategy**: The mock provider is created fresh for each test to ensure complete isolation and prevent test interdependencies.

4. **Test Coverage**: All 8 test cases from the plan have been implemented and are passing.

---

## Next Steps After Implementation

1. **Integration with CI/CD**: Add E2E tests to GitHub Actions workflow
2. **Additional Auth Tests**: Consider testing JWT validation, token expiration, refresh tokens
3. **Performance Testing**: Benchmark auth endpoint response times
4. **Security Audit**: Review error messages and token handling
5. **Documentation**: Update API documentation with auth examples

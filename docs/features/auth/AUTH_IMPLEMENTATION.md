# JWT Authentication Implementation

## Overview

This document describes the JWT-based authentication system that has been implemented in the Meridiano NestJS API.

## Features

- **JWT Token Authentication**: Secure token-based authentication using JSON Web Tokens
- **Password Encryption**: Passwords are hashed using bcrypt with 10 salt rounds
- **Global Route Protection**: All routes are protected by default using a global JWT guard
- **Public Routes**: Login and health check endpoints are marked as public
- **Token Expiration**: JWT tokens expire after 24 hours

## Architecture

```
Client Request
    ↓
    ├─→ /api/auth/login (Public) → AuthService → UsersService → Database
    │                                    ↓
    │                              JWT Token Generated
    │
    └─→ Protected Routes → JwtAuthGuard → JwtStrategy → Validate Token
                                              ↓
                                         Load User
                                              ↓
                                         Attach to Request
```

## Implementation Details

### Files Created

1. **Auth Module** (`src/auth/`)
   - `auth.module.ts` - Module configuration with JWT setup
   - `auth.controller.ts` - Login endpoint
   - `auth.service.ts` - Authentication logic
   - `dto/login.dto.ts` - Login request validation
   - `dto/login-response.dto.ts` - Login response structure
   - `strategies/jwt.strategy.ts` - Passport JWT strategy
   - `guards/jwt-auth.guard.ts` - JWT authentication guard
   - `decorators/public.decorator.ts` - Public route decorator

2. **Database Migration**
   - `migrations/1768134680163-AddPasswordToUsers.ts` - Adds password column

3. **Updated Files**
   - `src/users/user.entity.ts` - Added optional password field
   - `src/users/users.service.ts` - Added password hashing methods
   - `src/app.module.ts` - Configured global JWT guard
   - `src/app.controller.ts` - Marked public routes
   - `README.md` - Added JWT_SECRET to environment config

## API Endpoints

### Login (Public)

**POST** `/api/auth/login`

Request:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response (Success):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "username": "username"
  }
}
```

Response (Error):
```json
{
  "statusCode": 401,
  "message": "Invalid email or password"
}
```

### Protected Routes

All other routes require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Example:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:3001/api/articles
```

### Public Routes

The following routes do NOT require authentication:
- `GET /` - Root endpoint
- `GET /api/health` - Health check
- `POST /api/auth/login` - Login endpoint

## Environment Configuration

Add the following to your `.env` file:

```bash
# JWT Authentication
JWT_SECRET=your-secret-key-change-in-production
```

**Important**: Change the JWT_SECRET in production to a strong, random string.

## Usage Examples

### 1. Login to Get Token

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 2. Access Protected Route

```bash
# Save the token from login response
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Use token to access protected routes
curl http://localhost:3001/api/articles \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Token Expiration

Tokens expire after 24 hours. When a token expires, the API will return:

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

You'll need to login again to get a new token.

## Setting User Passwords

Since the authentication system requires passwords, you'll need to update existing users with passwords. You can use the `updateUserPassword` method in `UsersService`:

```typescript
// Example: In a script or endpoint
await usersService.updateUserPassword(userId, 'newPassword123');
```

Or directly in the database (using bcrypt):

```typescript
import * as bcrypt from 'bcrypt';

const password = 'password123';
const hashedPassword = await bcrypt.hash(password, 10);

// Update user in database with hashedPassword
```

## Security Considerations

1. **Password Hashing**: All passwords are hashed with bcrypt (10 salt rounds)
2. **JWT Secret**: Store in environment variables, never commit to version control
3. **Token Expiration**: Tokens expire after 24 hours for security
4. **HTTPS**: Always use HTTPS in production to protect tokens in transit
5. **Password Validation**: Minimum 6 characters required (configured in LoginDto)

## Creating a Public Route

To make a new route public (not require authentication), use the `@Public()` decorator:

```typescript
import { Public } from '../auth/decorators/public.decorator';

@Controller('api/example')
export class ExampleController {
  @Public()
  @Get()
  publicEndpoint() {
    return { message: 'This is public' };
  }

  @Get('protected')
  protectedEndpoint() {
    return { message: 'This requires authentication' };
  }
}
```

## Troubleshooting

### 401 Unauthorized Error

- **Check token**: Ensure the token is valid and not expired
- **Check header**: Ensure Authorization header is formatted correctly: `Bearer TOKEN`
- **Check JWT_SECRET**: Ensure JWT_SECRET environment variable is set

### Invalid credentials

- **Check user exists**: Verify the user exists in the database
- **Check password**: Ensure the user has a password set in the database
- **Check password hash**: Passwords must be hashed with bcrypt

### Missing JWT_SECRET

If JWT_SECRET is not set in environment variables, the system will use a default value. Always set this in production!

## Testing the Implementation

1. **Start the application**:
   ```bash
   pnpm run start:dev
   ```

2. **Create a test user** (if not exists):
   ```bash
   curl -X POST http://localhost:3001/api/users \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "username": "testuser"
     }'
   ```

3. **Update the user's password** (you'll need to add this functionality or do it manually in the database)

4. **Test login**:
   ```bash
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "yourpassword"
     }'
   ```

5. **Test protected route**:
   ```bash
   curl http://localhost:3001/api/articles \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

## Dependencies Added

- `@nestjs/jwt` - JWT token generation and validation
- `@nestjs/passport` - Passport integration for NestJS
- `passport` - Authentication middleware
- `passport-jwt` - JWT strategy for Passport
- `bcrypt` - Password hashing
- `@types/passport-jwt` - TypeScript types
- `@types/bcrypt` - TypeScript types

# Libs Directory

The `libs/` directory contains shared infrastructure modules and cross-cutting concerns that are used across multiple domain modules in the application.

## Purpose

The `libs/` directory separates infrastructure concerns from domain logic, making the codebase more maintainable and allowing infrastructure modules to be organized as reusable libraries.

## What Belongs in `libs/` vs `src/`

### `libs/` - Infrastructure & Shared Modules
- **Shared infrastructure modules**: S3, email, auth, database, redis, queue
- **Reusable utilities** used across multiple domain modules
- **Cross-cutting concerns** that don't belong to a specific domain
- **Modules that provide services** to multiple domain modules

### `src/` - Domain Logic
- **Domain-specific modules**: articles, users, briefings, etc.
- **Business logic and use cases**
- **API controllers and routes**
- **Domain entities and DTOs**
- **Feature-specific code**

## Directory Structure

Each library module follows NestJS conventions:

```
libs/
└── s3/
    ├── index.ts          # Barrel export (exports module and service)
    ├── s3.module.ts      # NestJS module definition
    ├── s3.service.ts     # Service implementation
    ├── s3.module.spec.ts # Module tests
    └── s3.service.spec.ts # Service tests
```

## Import Conventions

### Use `@libs/*` Path Aliases

Always use the `@libs/*` path alias for importing from libs modules:

```typescript
// ✅ Preferred: Barrel export
import { S3Module, S3Service } from '@libs/s3';

// ✅ Also valid: Direct file import
import { S3Module } from '@libs/s3/s3.module';

// ❌ Avoid: Relative paths
import { S3Service } from '../../libs/s3/s3.service';
```

### Barrel Export Pattern

Each lib module should have an `index.ts` file that exports the module and service:

```typescript
// libs/s3/index.ts
export { S3Module } from './s3.module';
export { S3Service } from './s3.service';
```

This enables clean imports via `@libs/module-name` without specifying file paths.

## Testing Patterns

### Unit Tests

Tests for lib modules are co-located with the source files:

```typescript
// libs/s3/s3.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { S3Service } from './s3.service';

describe('S3Service', () => {
  let service: S3Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [S3Service],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### Test Configuration

Jest is configured to resolve `@libs/*` imports:
- Unit tests: `moduleNameMapper` in `package.json` maps `@libs/*` to `libs/*`
- E2E tests: `moduleNameMapper` in `test/jest-e2e.json` maps `@libs/*` to `libs/*`

## Usage Examples

### Importing a Module

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { S3Module } from '@libs/s3';

@Module({
  imports: [S3Module],
})
export class AppModule {}
```

### Using a Service

```typescript
// src/articles/articles.controller.ts
import { Controller, Post } from '@nestjs/common';
import { S3Service } from '@libs/s3';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload')
  async uploadFile() {
    const url = await this.s3Service.generatePresignedPostUrl(
      'bucket-name',
      'file-key'
    );
    return { url };
  }
}
```

### Module Import in Feature Module

```typescript
// src/articles/articles.module.ts
import { Module } from '@nestjs/common';
import { S3Module } from '@libs/s3';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';

@Module({
  imports: [S3Module],
  controllers: [ArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
```

## Current Libraries

### S3 (`libs/s3/`)

AWS S3 integration module providing:
- `S3Module`: NestJS module for S3 integration
- `S3Service`: Service for S3 operations
  - `downloadMarkdownFile()`: Download markdown files from S3
  - `generatePresignedPostUrl()`: Generate presigned POST URLs for file uploads

**Migration Date**: January 2026
**Original Location**: `src/s3/`

### Email (`libs/email/`)

Email service module providing provider-agnostic email sending:
- `EmailModule`: NestJS module with `forRoot()` initialization pattern
- `EmailService`: Service for sending emails
  - `sendEmail()`: Send emails with support for multiple recipients and CC

**Initialization Pattern**: Uses `EmailModule.forRoot()` to dynamically configure the email provider based on environment variables.

**Supported Providers**:
- **Mailgun** (default) - Configured via `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` environment variables

**Usage Example**:
```typescript
import { Module } from '@nestjs/common';
import { EmailModule, EmailService } from '@libs/email';

@Module({
  imports: [EmailModule.forRoot()],
})
export class AppModule {}

// In a service
constructor(private readonly emailService: EmailService) {}

async sendEmail() {
  const result = await this.emailService.sendEmail({
    from: 'noreply@example.com',
    to: 'recipient@example.com',
    subject: 'Hello',
    text: 'Email body',
  });
}
```

**Migration Date**: January 2026
**Original Location**: `src/email/`

### Auth (`libs/auth/`)

Authentication infrastructure module providing JWT-based authentication:
- `AuthModule`: NestJS module with `forRoot()` and `forRootAsync()` initialization patterns
- `AuthService`: Service for user authentication and JWT token generation
  - `login()`: Authenticate user and generate JWT token
  - `validateUser()`: Validate user by ID
- `JwtAuthGuard`: Guard for protecting routes with JWT authentication
- `Public` decorator: Decorator to mark routes as public (bypass authentication)
- `LoginDto`: DTO for login requests
- `LoginResponseDto`: DTO for login responses

**Initialization Pattern**: Uses `AuthModule.forRoot()` or `AuthModule.forRootAsync()` to configure a `UserLookupProvider` implementation. The provider interface decouples the auth module from domain-specific user services.

**Usage Example**:
```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@libs/auth';
import { UsersModule } from '../users/users.module';
import { UserLookupProviderImpl } from './providers/user-lookup.provider';

@Module({
  imports: [
    UsersModule,
    AuthModule.forRootAsync({
      imports: [UsersModule],
      useFactory: (usersService: UsersService) => {
        return new UserLookupProviderImpl(usersService);
      },
      inject: [UsersService],
    }),
  ],
})
export class AuthModule {}

// In a controller
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService, LoginDto, LoginResponseDto, Public } from '@libs/auth';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto.email, loginDto.password);
  }
}
```

**Migration Date**: January 2026
**Original Location**: `src/auth/`

### Redis (`libs/redis/`)

Redis infrastructure module providing Redis client connection:
- `RedisModule`: NestJS module for Redis infrastructure
- `RedisService`: Service for Redis client connection
  - `getClient()`: Get the Redis client instance

**Usage Example**:
```typescript
import { Module } from '@nestjs/common';
import { RedisModule, RedisService } from '@libs/redis';

@Module({
  imports: [RedisModule],
})
export class ArticlesModule {}

// In a service
import { Injectable } from '@nestjs/common';
import { RedisService } from '@libs/redis';
import Redis from 'ioredis';

@Injectable()
export class ArticlesService {
  constructor(private readonly redisService: RedisService) {}

  async getRedisClient(): Promise<Redis> {
    return this.redisService.getClient();
  }
}
```

**Migration Date**: January 2026
**Original Location**: `libs/queue/redis.service.ts`

### Queue (`libs/queue/`)

Queue infrastructure module providing BullMQ-based job queue functionality with Redis:
- `QueueModule`: NestJS module for queue infrastructure
- `QueueService`: Service for managing job queues
  - `addArticleProcessingJob()`: Add article processing job to queue
  - `addMarkdownArticleProcessingJob()`: Add markdown article processing job to queue
  - `addTranscriptionSummaryJob()`: Add transcription summary job to queue
  - `getJobStatus()`: Get status of a job by ID
- Queue constants: `ARTICLE_PROCESSING_QUEUE`, `MARKDOWN_ARTICLE_PROCESSING_QUEUE`, `YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE`, `PROCESS_ARTICLE_JOB`, `PROCESS_MARKDOWN_ARTICLE_JOB`, `PROCESS_TRANSCRIPTION_SUMMARY_JOB`
- Job data interfaces: `ProcessArticleJobData`, `ProcessMarkdownArticleJobData`, `ProcessTranscriptionSummaryJobData`

**Architecture Notes**:
- QueueModule depends on RedisModule for Redis client connection
- Domain-specific processors (`MarkdownArticleProcessor`, `YoutubeTranscriptionProcessor`) are located in their respective domain modules (`src/articles/processors/`, `src/youtube-transcriptions/processors/`)
- Only infrastructure processors (`ArticleProcessor`) remain in QueueModule

**Usage Example**:
```typescript
import { Module } from '@nestjs/common';
import { QueueModule, QueueService, ARTICLE_PROCESSING_QUEUE } from '@libs/queue';

@Module({
  imports: [QueueModule],
})
export class ArticlesModule {}

// In a service
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QueueService, ARTICLE_PROCESSING_QUEUE } from '@libs/queue';

@Injectable()
export class ArticlesService {
  constructor(
    private readonly queueService: QueueService,
    @Inject(ARTICLE_PROCESSING_QUEUE) private readonly articleQueue: Queue,
  ) {}

  async processArticle(articleId: string, feedProfile: FeedProfile) {
    const jobInfo = await this.queueService.addArticleProcessingJob(
      articleId,
      feedProfile,
    );
    return jobInfo;
  }
}
```

**Migration Date**: January 2026
**Original Location**: `src/queue/`

## Planned Migrations

The following modules are candidates for migration to `libs/`:

- **Database** (`src/database/`) - Database connection and utilities

Migration decisions should be made based on:
1. Whether the module is used by multiple domain modules
2. Whether it represents infrastructure vs domain logic
3. Whether it would benefit from being a reusable library

## Configuration

### TypeScript Path Aliases

The `@libs/*` path alias is configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "@libs/*": ["libs/*"]
    }
  }
}
```

### Jest Configuration

Jest path mapping is configured in `package.json`:

```json
{
  "jest": {
    "moduleNameMapper": {
      "^@libs/(.*)$": "<rootDir>/../libs/$1"
    }
  }
}
```

## Best Practices

1. **Always use barrel exports**: Create an `index.ts` file that exports the module and service
2. **Use `@libs/*` imports**: Never use relative paths to libs modules
3. **Keep libs focused**: Each lib should have a single, well-defined purpose
4. **Co-locate tests**: Place test files next to the source files they test
5. **Document exports**: Ensure public APIs are clearly documented
6. **Follow NestJS patterns**: Use `@Injectable()`, `@Module()`, etc. consistently

## Migration Guide

When migrating a module from `src/` to `libs/`:

1. **Create lib directory**: `mkdir -p libs/module-name`
2. **Move files with git**: `git mv src/module-name/* libs/module-name/`
3. **Create barrel export**: Add `libs/module-name/index.ts`
4. **Update TypeScript config**: Path alias should already work
5. **Update Jest config**: Path mapping should already work
6. **Update imports**: Change all imports to use `@libs/module-name`
7. **Update documentation**: Add module to this README
8. **Run tests**: Verify all tests pass
9. **Commit**: Use conventional commit message

See `.cursorrules` for more detailed migration patterns.

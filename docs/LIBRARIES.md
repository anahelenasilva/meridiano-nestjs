# Meridiano Libraries Documentation

This document provides detailed documentation for all infrastructure libraries in the `libs/` directory.

---

## 📚 Table of Contents

- [Overview](#overview)
- [Auth Library](#auth-library)
- [Database Library](#database-library)
- [Queue Library](#queue-library)
- [Redis Library](#redis-library)
- [S3 Library](#s3-library)
- [Email Library](#email-library)
- [Audio Library](#audio-library)

---

## Overview

The `libs/` directory contains shared infrastructure modules that provide cross-cutting concerns for the application. These libraries follow NestJS best practices and are designed to be reusable across multiple domain modules.

### Import Convention

Always use the `@libs/*` path alias:

```typescript
// ✅ Preferred
import { S3Module, S3Service } from '@libs/s3';

// ❌ Avoid
import { S3Service } from '../../libs/s3/s3.service';
```

### Module Structure

Each library follows this structure:

```
libs/module-name/
├── index.ts              # Barrel export
├── module-name.module.ts # NestJS module
├── module-name.service.ts # Main service
├── *.spec.ts             # Unit tests
├── interfaces/           # TypeScript interfaces
├── constants/            # Constants and enums
├── decorators/           # Custom decorators
├── guards/               # Auth guards
├── strategies/           # Passport strategies
└── providers/            # Service providers
```

---

## Auth Library

**Location**: [`libs/auth/`](../libs/auth/)

### Purpose

Provides JWT-based authentication infrastructure with Passport.js integration.

### Exports

```typescript
// From @libs/auth
export { AuthModule } from './auth.module';
export { AuthService } from './auth.service';
export { JwtAuthGuard } from './guards/jwt-auth.guard';
export { Public } from './decorators/public.decorator';
export { LoginDto, LoginResponseDto } from './dto';
```

### Setup

#### 1. Import AuthModule

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@libs/auth';
import { UsersModule } from '../users/users.module';
import { UserLookupProvider } from './providers/user-lookup.provider';

@Module({
  imports: [
    UsersModule,
    AuthModule.forRootAsync({
      imports: [UsersModule],
      useFactory: (usersService: UsersService) => {
        return new UserLookupProvider(usersService);
      },
      inject: [UsersService],
    }),
  ],
})
export class AppModule {}
```

#### 2. Implement UserLookupProvider

```typescript
import { Injectable } from '@nestjs/common';
import { UserLookupProvider as IUserLookupProvider } from '@libs/auth';
import { UsersService } from '../users/users.service';

@Injectable()
export class UserLookupProvider implements IUserLookupProvider {
  constructor(private readonly usersService: UsersService) {}

  async findByEmail(email: string) {
    return this.usersService.findByEmail(email);
  }

  async validatePassword(user: any, password: string) {
    return this.usersService.validatePassword(user, password);
  }
}
```

#### 3. Protect Routes

```typescript
import { Controller, Get } from '@nestjs/common';
import { Public } from '@libs/auth';

@Controller('api/articles')
export class ArticlesController {
  // Protected route (default)
  @Get()
  async listArticles() {
    // Requires authentication
  }

  // Public route
  @Public()
  @Get('public')
  async getPublicArticles() {
    // No authentication required
  }
}
```

### AuthService API

```typescript
class AuthService {
  /**
   * Authenticate user and generate JWT token
   */
  async login(email: string, password: string): Promise<LoginResponseDto>;

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: string): Promise<any>;
}
```

### Environment Variables

```bash
JWT_SECRET=your-secret-key-minimum-32-characters
```

---

## Database Library

**Location**: [`libs/database/`](../libs/database/)

### Purpose

Provides PostgreSQL connection management with TypeORM integration and automatic migrations.

### Exports

```typescript
// From @libs/database
export { DatabaseModule } from './database.module';
export { DatabaseService } from './database.service';
export { AbstractDatabaseService } from './abstract-database.service';
export { PostgresDatabaseService } from './postgres-database.service';
export { IDatabaseService } from './database.interface';
```

### Setup

#### 1. Import DatabaseModule

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@libs/database';

@Module({
  imports: [DatabaseModule],
})
export class AppModule {}
```

#### 2. Configure Environment

```bash
# Option 1: Full URL
DATABASE_URL=postgresql://user:password@localhost:5432/meridian

# Option 2: Individual variables
DATABASE_USER=postgres
DATABASE_PASSWORD=password
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=meridian
```

### Usage

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@libs/database';

@Injectable()
export class ArticlesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getArticles() {
    const queryRunner = this.databaseService.getQueryRunner();
    // Use queryRunner for transactions
  }
}
```

### DatabaseService API

```typescript
class DatabaseService {
  /**
   * Get a TypeORM query runner for transactions
   */
  getQueryRunner(): QueryRunner;

  /**
   * Get the TypeORM data source
   */
  getDataSource(): DataSource;

  /**
   * Run migrations on startup (called automatically)
   */
  runMigrations(): Promise<void>;
}
```

### Migrations

Create and run migrations:

```bash
# Create a new migration
pnpm run migration:create src/database/migrations/AddNewColumn

# Generate migration from entity changes
pnpm run migration:generate src/database/migrations/UpdateSchema

# Run pending migrations
pnpm run migration:run

# Revert last migration
pnpm run migration:revert
```

---

## Queue Library

**Location**: [`libs/queue/`](../libs/queue/)

### Purpose

Provides BullMQ-based job queue infrastructure for background processing.

### Exports

```typescript
// From @libs/queue
export { QueueModule } from './queue.module';
export { QueueService } from './queue.service';
export {
  ARTICLE_PROCESSING_QUEUE,
  MARKDOWN_ARTICLE_PROCESSING_QUEUE,
  YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE,
  AUDIO_GENERATION_QUEUE,
} from './constants/queue.constants';
export {
  ProcessArticleJobData,
  ProcessMarkdownArticleJobData,
  ProcessTranscriptionSummaryJobData,
  AudioGenerationJobData,
} from './interfaces';
```

### Setup

#### 1. Import QueueModule

```typescript
import { Module } from '@nestjs/common';
import { QueueModule } from '@libs/queue';

@Module({
  imports: [QueueModule],
})
export class AppModule {}
```

#### 2. Configure Redis

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Usage

#### Adding Jobs

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from '@libs/queue';

@Injectable()
export class ArticlesService {
  constructor(private readonly queueService: QueueService) {}

  async processArticle(articleId: string, feedProfile: string) {
    const jobInfo = await this.queueService.addArticleProcessingJob(
      articleId,
      feedProfile,
    );
    return jobInfo;
  }
}
```

#### Creating a Processor

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import {
  ARTICLE_PROCESSING_QUEUE,
  ProcessArticleJobData,
} from '@libs/queue';

@Processor(ARTICLE_PROCESSING_QUEUE)
export class ArticleProcessor {
  @Process('process-article')
  async processArticle(job: Job<ProcessArticleJobData>) {
    const { articleId, feedProfile } = job.data;
    // Process article
  }
}
```

### QueueService API

```typescript
class QueueService {
  /**
   * Add article processing job
   */
  async addArticleProcessingJob(
    articleId: string,
    feedProfile: string,
  ): Promise<JobInfo>;

  /**
   * Add markdown article processing job
   */
  async addMarkdownArticleProcessingJob(
    bucketName: string,
    s3Key: string,
    feedProfile: string,
  ): Promise<JobInfo>;

  /**
   * Add transcription summary job
   */
  async addTranscriptionSummaryJob(
    transcriptionId: string,
    text: string,
    title: string,
  ): Promise<JobInfo>;

  /**
   * Add audio generation job
   */
  async addAudioGenerationJob(
    sourceType: 'article' | 'transcription',
    sourceId: string,
    text: string,
    date: Date,
  ): Promise<JobInfo>;

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<JobStatus>;
}
```

### Available Queues

| Queue Name | Purpose | Processor Location |
|------------|---------|-------------------|
| `article-processing` | Process scraped articles | `libs/queue/processors/article.processor.ts` |
| `markdown-article-processing` | Process uploaded markdown | `src/articles/processors/markdown.processor.ts` |
| `youtube-transcription-summary` | Generate AI summaries | `src/youtube-transcriptions/processors/transcription.processor.ts` |
| `audio-generation` | Generate TTS audio | `libs/queue/processors/audio-generation.processor.ts` |

---

## Redis Library

**Location**: [`libs/redis/`](../libs/redis/)

### Purpose

Provides Redis client connection management.

### Exports

```typescript
// From @libs/redis
export { RedisModule } from './redis.module';
export { RedisService } from './redis.service';
```

### Setup

```typescript
import { Module } from '@nestjs/common';
import { RedisModule } from '@libs/redis';

@Module({
  imports: [RedisModule],
})
export class AppModule {}
```

### Usage

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from '@libs/redis';
import Redis from 'ioredis';

@Injectable()
export class CacheService {
  constructor(private readonly redisService: RedisService) {}

  async getCache(key: string) {
    const client = await this.redisService.getClient();
    return client.get(key);
  }

  async setCache(key: string, value: string, ttl: number) {
    const client = await this.redisService.getClient();
    return client.setex(key, ttl, value);
  }
}
```

### RedisService API

```typescript
class RedisService {
  /**
   * Get Redis client instance
   */
  async getClient(): Promise<Redis>;
}
```

---

## S3 Library

**Location**: [`libs/s3/`](../libs/s3/)

### Purpose

Provides AWS S3 operations including file upload, download, and presigned URL generation.

### Exports

```typescript
// From @libs/s3
export { S3Module } from './s3.module';
export { S3Service } from './s3.service';
```

### Setup

#### 1. Import S3Module

```typescript
import { Module } from '@nestjs/common';
import { S3Module } from '@libs/s3';

@Module({
  imports: [S3Module],
})
export class AppModule {}
```

#### 2. Configure AWS Credentials

```bash
# Option 1: Environment variables
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Option 2: IAM role (when running on AWS)
# No configuration needed
```

### Usage

```typescript
import { Injectable } from '@nestjs/common';
import { S3Service } from '@libs/s3';

@Injectable()
export class ArticlesService {
  constructor(private readonly s3Service: S3Service) {}

  async getMarkdownFile(bucket: string, key: string) {
    const content = await this.s3Service.downloadMarkdownFile(bucket, key);
    return content;
  }

  async getUploadUrl(bucket: string, key: string) {
    const result = await this.s3Service.generatePresignedPostUrl(
      bucket,
      key,
      'text/markdown',
      1024 * 1024, // 1MB max
    );
    return result;
  }
}
```

### S3Service API

```typescript
class S3Service {
  /**
   * Download a markdown file from S3
   */
  async downloadMarkdownFile(
    bucketName: string,
    key: string,
  ): Promise<string>;

  /**
   * Generate presigned POST URL for direct upload
   */
  async generatePresignedPostUrl(
    bucketName: string,
    key: string,
    contentType: string,
    fileSize: number,
  ): Promise<PresignedPostUrl>;

  /**
   * Generate presigned GET URL for download
   */
  async generatePresignedGetUrl(
    bucketName: string,
    key: string,
    expiresIn: number,
  ): Promise<string>;

  /**
   * Upload file buffer to S3
   */
  async uploadFile(
    bucketName: string,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void>;
}
```

### Presigned URL Usage

**Upload**:
```typescript
const { url, fields } = await s3Service.generatePresignedPostUrl(
  'my-bucket',
  'article.md',
  'text/markdown',
  1024,
);

// Client-side upload
const formData = new FormData();
Object.entries(fields).forEach(([key, value]) => {
  formData.append(key, value);
});
formData.append('file', file);

await fetch(url, {
  method: 'POST',
  body: formData,
});
```

---

## Email Library

**Location**: [`libs/email/`](../libs/email/)

### Purpose

Provides email sending capabilities with provider abstraction.

### Exports

```typescript
// From @libs/email
export { EmailModule } from './email.module';
export { EmailService } from './email.service';
export { EmailProvider } from './interfaces/email-provider.interface';
export { SendEmailOptions } from './interfaces/send-email-options.interface';
```

### Setup

#### 1. Import with forRoot()

```typescript
import { Module } from '@nestjs/common';
import { EmailModule } from '@libs/email';

@Module({
  imports: [EmailModule.forRoot()],
})
export class AppModule {}
```

#### 2. Configure Environment

```bash
# Mailgun (default)
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.yourdomain.com
```

### Usage

```typescript
import { Injectable } from '@nestjs/common';
import { EmailService } from '@libs/email';

@Injectable()
export class NotificationService {
  constructor(private readonly emailService: EmailService) {}

  async sendWelcomeEmail(userEmail: string) {
    await this.emailService.sendEmail({
      from: 'noreply@meridiano.app',
      to: userEmail,
      subject: 'Welcome to Meridiano!',
      text: 'Thank you for signing up...',
      html: '<h1>Welcome!</h1><p>Thank you...</p>',
    });
  }
}
```

### EmailService API

```typescript
class EmailService {
  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<void>;
}

interface SendEmailOptions {
  from: string;
  to: string | string[];
  cc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
}
```

---

## Audio Library

**Location**: [`libs/audio/`](../libs/audio/)

### Purpose

Provides audio job management and queue integration for text-to-speech generation.

### Exports

```typescript
// From @libs/audio
export { AudioModule } from './audio.module';
export { AudioJobService } from './services/audio-job.service';
export { AUDIO_GENERATION_SUCCESS_MESSAGE } from './constants/audio.constants';
export {
  AudioJobData,
  AudioJobStatus,
} from './interfaces/audio-job.interface';
```

### Setup

```typescript
import { Module } from '@nestjs/common';
import { AudioModule } from '@libs/audio';

@Module({
  imports: [AudioModule],
})
export class AppModule {}
```

### Usage

```typescript
import { Injectable } from '@nestjs/common';
import { AudioJobService } from '@libs/audio';

@Injectable()
export class ArticlesService {
  constructor(private readonly audioJobService: AudioJobService) {}

  async generateAudio(articleId: string, text: string) {
    const jobInfo = await this.audioJobService.enqueueAudioJobIfNotDuplicate({
      sourceType: 'article',
      sourceId: articleId,
      text,
      date: new Date(),
    });

    if (!jobInfo) {
      throw new Error('Audio generation already in progress');
    }

    return jobInfo;
  }

  async checkAudioStatus(jobId: string) {
    return this.audioJobService.getJobStatus(jobId);
  }
}
```

### AudioJobService API

```typescript
class AudioJobService {
  /**
   * Enqueue audio generation job if not already queued for this source
   */
  async enqueueAudioJobIfNotDuplicate(
    data: AudioJobData,
  ): Promise<JobInfo | null>;

  /**
   * Get audio generation job status
   */
  async getJobStatus(jobId: string): Promise<AudioJobStatus | null>;
}

interface AudioJobData {
  sourceType: 'article' | 'transcription';
  sourceId: string;
  text: string;
  date: Date;
}

interface JobInfo {
  jobId: string;
}
```

---

## Testing Libraries

### Unit Testing

Each library includes co-located unit tests:

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

### Jest Configuration

The `@libs/*` path alias is configured in `package.json`:

```json
{
  "jest": {
    "moduleNameMapper": {
      "^@libs/(.*)$": "<rootDir>/libs/$1"
    }
  }
}
```

---

## Best Practices

### 1. Use Barrel Exports

Each library should export its public API through `index.ts`:

```typescript
// libs/s3/index.ts
export { S3Module } from './s3.module';
export { S3Service } from './s3.service';
```

### 2. Dependency Injection

Always use constructor injection:

```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly queueService: QueueService,
  ) {}
}
```

### 3. Async Initialization

For modules requiring dynamic configuration, use `forRoot()` or `forRootAsync()`:

```typescript
// Static configuration
EmailModule.forRoot()

// Async configuration
AuthModule.forRootAsync({
  imports: [UsersModule],
  useFactory: (usersService) => new UserLookupProvider(usersService),
  inject: [UsersService],
})
```

### 4. Error Handling

Libraries should throw meaningful errors:

```typescript
if (!bucketName) {
  throw new BadRequestException('S3 bucket name not configured');
}
```

### 5. Documentation

Document public APIs with JSDoc comments:

```typescript
/**
 * Generate a presigned URL for direct S3 upload
 * @param bucketName - S3 bucket name
 * @param key - Object key (path)
 * @param contentType - MIME type of the file
 * @param fileSize - Maximum file size in bytes
 * @returns Presigned POST URL and form fields
 */
async generatePresignedPostUrl(
  bucketName: string,
  key: string,
  contentType: string,
  fileSize: number,
): Promise<PresignedPostUrl>;
```

---

*Last updated: March 2026*

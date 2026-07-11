# Libraries (`libs/`) Reference

This document describes the current shared infrastructure libraries in `libs/` and how they are used in the application.

## Overview

The `libs/` directory contains reusable infrastructure modules and cross-cutting concerns. Domain-specific business logic remains in `src/`.

Current libraries:

- `auth`
- `audio`
- `database`
- `email`
- `queue`
- `redis`
- `s3`

## Import Convention

Use the `@libs/*` alias instead of relative paths.

```typescript
import { S3Module, S3Service } from '@libs/s3';
import { DatabaseModule } from '@libs/database';
```

Path mapping is configured in:

- `tsconfig.json` (`@libs/*` -> `libs/*`)
- `package.json` Jest `moduleNameMapper`
- `test/jest-e2e.json` `moduleNameMapper`

## Library Summary

| Library | Main role | Typical import |
| --- | --- | --- |
| `@libs/auth` | JWT auth + auth helpers + rate limiting | `AuthModule`, `AuthService`, `JwtAuthGuard`, `CurrentUser` |
| `@libs/audio` | Audio generation queue orchestration | `AudioModule`, `AudioJobService` |
| `@libs/database` | Postgres access + TypeORM bootstrapping | `DatabaseModule`, `DatabaseService` |
| `@libs/email` | Provider-based email sending (Mailgun currently) | `EmailModule.forRoot()`, `EmailService` |
| `@libs/queue` | BullMQ queues for article/transcription processing | `QueueModule`, `QueueService` |
| `@libs/redis` | Shared Redis client lifecycle management | `RedisModule`, `RedisService` |
| `@libs/s3` | S3 file retrieval/upload/presigned URLs | `S3Module`, `S3Service` |

## Auth Library

**Location:** `libs/auth/`

### Exports

- `AuthModule`
- `AuthService`
- `USER_LOOKUP_PROVIDER_TOKEN`
- `CurrentUser`
- `AuthenticatedUser` (type)
- `JwtAuthGuard`
- `JwtStrategy`
- `Public`, `IS_PUBLIC_KEY`
- `LoginDto`, `LoginResponseDto`
- `RateLimit`, `RateLimitGuard`, `RateLimitService`
- `RateLimitOptions` (type)

### Initialization

`AuthModule` is dynamic and supports:

- `AuthModule.forRoot(UserLookupProviderClass)`
- `AuthModule.forRootAsync({ useFactory, inject, imports })`

`JWT_SECRET` is required and validated during module initialization.

### Request-scoped auth helpers

- `CurrentUser`: controller param decorator that injects the authenticated JWT user
- `AuthenticatedUser`: shared type for the authenticated user payload currently exposed to controllers

### User lookup contract

The auth lib expects a provider implementing `UserLookupProvider`:

- `getUserByEmail(email, includePassword)`
- `getUserById(userId)`

### Environment variables

- `JWT_SECRET`

## Database Library

**Location:** `libs/database/`

### Exports

- `DatabaseModule`
- `DatabaseService`
- `AbstractDatabaseService`
- `PostgresDatabaseService`
- Database connection/statement types from `database.interface.ts`
- `typeormConfig` and default `dataSource`

### Behavior

- `DatabaseModule` is marked as global (`@Global()`).
- It configures `TypeOrmModule.forRoot(...)`.
- On startup, it attempts to run pending migrations with TypeORM.
- On shutdown, it closes DB resources.

### Environment variables

Supported configuration paths:

- `DATABASE_URL`
- or individual fields:
  - `DATABASE_USER` / `PGUSER`
  - `DATABASE_PASSWORD` / `PGPASSWORD`
  - `DATABASE_HOST` / `PGHOST`
  - `DATABASE_PORT` / `PGPORT`
  - `DATABASE_NAME` / `PGDATABASE`
- optional: `DATABASE_SSL=true`

## Queue Library

**Location:** `libs/queue/`

### Exports

- `QueueModule`
- `QueueService`
- Queue names:
  - `ARTICLE_PROCESSING_QUEUE`
  - `MARKDOWN_ARTICLE_PROCESSING_QUEUE`
  - `YOUTUBE_TRANSCRIPTION_SUMMARY_QUEUE`
  - `AUDIO_GENERATION_QUEUE`
- Job names:
  - `PROCESS_ARTICLE_JOB`
  - `PROCESS_MARKDOWN_ARTICLE_JOB`
  - `PROCESS_TRANSCRIPTION_SUMMARY_JOB`
  - `GENERATE_AUDIO_JOB`
- Job payload types:
  - `ProcessArticleJobData`
  - `ProcessMarkdownArticleJobData`
  - `ProcessTranscriptionSummaryJobData`

### Behavior

- Creates BullMQ queues backed by `RedisService`.
- Handles enqueueing and status lookup for article/transcription jobs.
- Subscribes to queue failure events and sends notification emails on terminal failures.
- Includes processors in `libs/queue/processors/` for infrastructure-level queue execution.

## Audio Library

**Location:** `libs/audio/`

### Exports

- `AudioModule`
- `AudioJobService`
- `AUDIO_GENERATION_SUCCESS_MESSAGE`
- Audio types:
  - `GenerateAudioJobData`
  - `AudioJobStatus`
  - `EnqueueOptions`
  - `JobInfo`

### Behavior

- Provisions the `AUDIO_GENERATION_QUEUE` BullMQ queue.
- Prevents duplicate enqueue operations using a Redis lock.
- Supports fire-and-forget and optional wait-for-completion modes.
- Exposes querying and cancellation helpers for audio jobs.

## Redis Library

**Location:** `libs/redis/`

### Exports

- `RedisModule`
- `RedisService`

### Behavior

- Creates a shared `ioredis` client in service constructor.
- Registers lifecycle hooks for connect/error logging and cleanup.
- Supports Redis URL mode and host/port mode.

### Environment variables

- URL mode: `REDIS_URL` or `REDISCLOUD_URL`
- host/port mode:
  - `REDIS_HOST`
  - `REDIS_PORT`
  - `REDIS_PASSWORD` (optional)

## S3 Library

**Location:** `libs/s3/`

### Exports

- `S3Module`
- `S3Service`

### Supported operations

- `downloadMarkdownFile(bucketName, key)`
- `generatePresignedPostUrl(bucketName, key, contentType?, maxFileSize?)`
- `uploadAudioFile(bucketName, key, audioBuffer, contentType?)`
- `generatePresignedGetUrl(bucketName, key, expiresIn?)`

### Environment variables

- `AWS_REGION` (defaults to `us-east-1`)
- optional credential pair for explicit auth:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`

## Email Library

**Location:** `libs/email/`

### Exports

- `EmailModule`
- `EmailService`

### Initialization

Always import with `EmailModule.forRoot()` so provider wiring is configured.

Current provider strategy:

- `EMAIL_PROVIDER=mailgun` (default if omitted)

### Environment variables (Mailgun)

- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_URL` (optional, for EU endpoint)

### Service contract

`EmailService.sendEmail(options)` forwards to the configured provider and returns `SendEmailResult`.

## Usage in AppModule

`src/app.module.ts` currently imports these libs directly:

- `DatabaseModule`
- `QueueModule`
- `S3Module`
- `JwtAuthGuard` (as global `APP_GUARD`, provided through auth setup)

Other libs are imported through feature modules as needed (for example `EmailModule.forRoot()` inside queue module wiring).

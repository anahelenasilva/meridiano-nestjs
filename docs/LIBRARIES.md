# Libraries (`libs/`) Reference

This document describes the current shared infrastructure libraries in `libs/` and how they are used in the application.

## Overview

The `libs/` directory contains reusable infrastructure modules and cross-cutting concerns. Domain-specific business logic remains in `src/`.

Current libraries:

- `audio`
- `database`
- `email`
- `env`
- `queue`
- `rate-limit`
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
| `@libs/audio` | Audio generation queue orchestration | `AudioModule`, `AudioJobService` |
| `@libs/database` | Postgres access + TypeORM bootstrapping | `DatabaseModule`, `DatabaseService` |
| `@libs/email` | Email sending through Mailgun | `EmailModule.forRootAsync()`, `EmailService` |
| `@libs/env` | Loads `.env` into `process.env` at each entry point | `loadEnv` from `@libs/env/load-env` |
| `@libs/queue` | BullMQ queues for article/transcription processing | `QueueModule`, `QueueService` |
| `@libs/rate-limit` | Redis-backed request throttling for HTTP routes | `RateLimitModule`, `RateLimitGuard`, `@RateLimit()` |
| `@libs/redis` | Shared Redis client lifecycle management | `RedisModule`, `RedisService` |
| `@libs/s3` | S3 file retrieval/upload/presigned URLs | `S3Module`, `S3Service` |

## Database Library

**Location:** `libs/database/`

### Exports

- `DatabaseModule`
- `DatabaseService`
- Database connection/statement types from `database.interface.ts`
- `typeormConfig` and default `dataSource`

### Behavior

- `DatabaseModule` is marked as global (`@Global()`).
- It configures `TypeOrmModule.forRoot(...)`.
- On startup, it attempts to run pending migrations with TypeORM.
- Both `pg` pools, `DatabaseService`'s and TypeORM's, read TIMESTAMP columns as UTC through `typeParsers` in `type-parsers.ts`.
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
  - `CUSTOM_BRIEFING_GENERATION_QUEUE`
  - `NEWS_DIGEST_QUEUE`
  - `TRANSCRIPT_BACKUP_QUEUE`
  - `YOUTUBE_TRANSCRIPT_INGEST_QUEUE`
- Job names:
  - `PROCESS_ARTICLE_JOB`
  - `PROCESS_MARKDOWN_ARTICLE_JOB`
  - `PROCESS_TRANSCRIPTION_SUMMARY_JOB`
  - `GENERATE_AUDIO_JOB`
  - `GENERATE_CUSTOM_BRIEFING_JOB`
  - `NEWS_DIGEST_JOB`
  - `BACKUP_TRANSCRIPT_JOB`
  - `INGEST_TRANSCRIPT_JOB`
- Job payload types:
  - `ProcessTranscriptionSummaryJobData`
  - `BackupTranscriptJobData`
  - `IngestTranscriptJobData`
- Enqueue result types:
  - `JobInfo`
  - `JobStatus`

### Behavior

- Creates BullMQ queues backed by `RedisService`. Queues that retry set their attempts and backoff once in `defaultJobOptions`, except Curated Briefing, whose retries come from config in its single enqueue call. Article and transcription summary jobs run once.
- Handles enqueueing for YouTube Transcription jobs and status lookup for article and Curated Briefing jobs.
- Imports no app code. Domain modules own their job payload types, the enqueue code for payloads that carry a `FeedProfile` (`ArticleJobsService` in articles, `GenerateCustomBriefUseCase` in briefings), and their terminal-failure notifiers (`MarkdownUploadFailureNotifier`, `AudioGenerationFailureNotifier`).
- `createWorker(queue, handler, { logger, concurrency, onTerminalFailure })` starts a worker on a `QueueModule` queue. Import it from `@libs/queue/create-worker`; the barrel would load `QueueModule` and `RedisModule` into worker specs. It logs retries and terminal failures, logs Redis connection resets at debug level, and calls `onTerminalFailure` once when the job's last configured attempt fails or it throws an `UnrecoverableError`. Every worker uses it.

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

## Env Library

**Location:** `libs/env/`

### Exports

- `loadEnv()` and `dropEmptyEnvVars(env)`, from `@libs/env/load-env`

### Behavior

- Every entry point calls `loadEnv()` before anything reads `process.env`: `src/main.ts`, the `src/scripts/run*.ts` scripts, `libs/database/typeorm.config.ts` and `scripts/run-migrations.ts`.
- A variable the shell exported wins over `.env`, but one exported empty counts as unset, so `.env` fills it.
- The TypeORM CLI and `pnpm migration:run` resolve `@libs/*` through the `ts-node.require` entry in `tsconfig.json`, which loads `tsconfig-paths/register`.

## Rate Limit Library

**Location:** `libs/rate-limit/`

### Exports

- `RateLimitModule`: imports `RedisModule`, provides and exports `RateLimitService` and `RateLimitGuard`. Import it in any module whose controllers use the guard or a subclass of it.
- `RateLimitGuard`, `@RateLimit({ windowMs, maxAttempts })`
- `RateLimitService`
- Types: `RateLimitConfig`, `RateLimitResult`, `RateLimitOptions`, `RateLimitRequest`
- `@libs/rate-limit/in-memory-redis.fake`: `InMemoryRedis`, a test stand-in for the Redis client. Tests only.

### Behavior

- `RateLimitGuard` buckets requests by caller IP, with window and limit from `@RateLimit()` (default 15 minutes, 5 attempts). A route that buckets by something else subclasses the guard and overrides `resolveKey`, as `ExternalRateLimitGuard` in `src/articles/guards/` does to give verified external tokens their own bucket.
- The guard calls `RateLimitService.consume(key, { windowMs, maxAttempts })`, which counts the request in one Redis transaction under `rate_limit:<key>` and returns `{ allowed, remaining, resetAt }` for the `X-RateLimit-*` headers and the 429.
- If Redis fails, `consume` lets the request through.

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
- `uploadFile(bucketName, key, body, contentType)`
- `deleteObject(bucketName, key)`
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
- `MailgunConfig` (type)

### Initialization

The app passes its Mailgun settings in, so the lib never imports `src/config`:

```typescript
EmailModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config) => config.getMailgunConfig(),
});
```

`useFactory` returns a `MailgunConfig` or a Promise of one, and its arguments take their types from `inject`. `inject` tokens must come from a global module, like the app's `ConfigModule`.

### Environment variables (Mailgun)

- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_URL` (optional, for EU endpoint)

### Service contract

`EmailService.sendEmail(options)` sends through Mailgun and rejects with Mailgun's error when the send fails.

## Usage in AppModule

`src/app.module.ts` currently imports these libs directly:

- `DatabaseModule`
- `QueueModule`
- `S3Module`

Other libs are imported through feature modules as needed. Each feature module that sends email imports `EmailModule.forRootAsync()` itself.

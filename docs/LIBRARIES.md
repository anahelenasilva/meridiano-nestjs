# Libraries (`libs/`) Reference

Each lib's behavior, gotchas and env vars: what one file read of its entry point does not tell you. What a lib is and how to import one is in the [libs README](../libs/README.md).

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

### Behavior

- Creates BullMQ queues backed by `RedisService`. Queues that retry set their attempts and backoff once in `defaultJobOptions`, except Curated Briefing, whose retries come from config in its single enqueue call. Article and transcription summary jobs run once.
- Handles enqueueing for YouTube Transcription jobs and status lookup for article and Curated Briefing jobs.
- Imports no app code. Domain modules own their job payload types, the enqueue code for payloads that carry a `FeedProfile` (`ArticleJobsService` in articles, `GenerateCustomBriefUseCase` in briefings), and their terminal-failure notifiers (`MarkdownUploadFailureNotifier`, `AudioGenerationFailureNotifier`).
- `createWorker(queue, handler, { logger, concurrency, onTerminalFailure })` starts a worker on a `QueueModule` queue. Import it from `@libs/queue/create-worker`; the barrel would load `QueueModule` and `RedisModule` into worker specs. It logs retries and terminal failures, logs Redis connection resets at debug level, and calls `onTerminalFailure` once when the job's last configured attempt fails or it throws an `UnrecoverableError`. Every worker uses it.

## Audio Library

**Location:** `libs/audio/`

### Behavior

- Provisions the `AUDIO_GENERATION_QUEUE` BullMQ queue.
- Prevents duplicate enqueue operations using a Redis lock.
- Supports fire-and-forget and optional wait-for-completion modes.
- Exposes querying and cancellation helpers for audio jobs.

## Env Library

**Location:** `libs/env/`

### Behavior

- Every entry point calls `loadEnv()` before anything reads `process.env`: `src/main.ts`, the `src/scripts/run*.ts` scripts, `libs/database/typeorm.config.ts` and `scripts/run-migrations.ts`.
- A variable the shell exported wins over `.env`, but one exported empty counts as unset, so `.env` fills it.
- The TypeORM CLI and `pnpm migration:run` resolve `@libs/*` through the `ts-node.require` entry in `tsconfig.json`, which loads `tsconfig-paths/register`.

## Rate Limit Library

**Location:** `libs/rate-limit/`

### Behavior

- Import `RateLimitModule` in any module whose controllers use `RateLimitGuard` or a subclass of it. It imports `RedisModule` itself.
- `RateLimitGuard` buckets requests by caller IP, with window and limit from `@RateLimit()` (default 15 minutes, 5 attempts). A route that buckets by something else subclasses the guard and overrides `resolveKey`, as `ExternalRateLimitGuard` in `src/articles/guards/` does to give verified external tokens their own bucket.
- The guard calls `RateLimitService.consume(key, { windowMs, maxAttempts })`, which counts the request in one Redis transaction under `rate_limit:<key>` and returns `{ allowed, remaining, resetAt }` for the `X-RateLimit-*` headers and the 429.
- If Redis fails, `consume` lets the request through.
- Tests use `InMemoryRedis` from `@libs/rate-limit/in-memory-redis.fake` as a stand-in for the Redis client. Tests only.

## Redis Library

**Location:** `libs/redis/`

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

### Environment variables

- `AWS_REGION` (defaults to `us-east-1`)
- optional credential pair for explicit auth:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`

## Email Library

**Location:** `libs/email/`

### Initialization

The app passes its Mailgun settings in, so the lib never imports `src/config`:

```typescript
EmailModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config) => config.getMailgunConfig(),
});
```

`useFactory` returns a `MailgunConfig` or a Promise of one, and its arguments take their types from `inject`. `inject` tokens must come from a global module, like the app's `ConfigModule`. Each feature module that sends email imports `EmailModule.forRootAsync()` itself.

### Environment variables (Mailgun)

- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_URL` (optional, for EU endpoint)

### Service contract

`EmailService.sendEmail(options)` sends through Mailgun and rejects with Mailgun's error when the send fails.

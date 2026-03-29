# Meridiano - Project Overview

## What Meridiano Is

Meridiano is a modular NestJS backend that ingests content from RSS feeds, manual article URLs, and YouTube videos, enriches that content with AI, and serves authenticated APIs for article discovery, briefings, transcription browsing, and audio generation.

The system is built around async processing: HTTP requests enqueue heavy jobs, workers process them, and results are persisted in PostgreSQL and S3.

## Current Product Scope

Meridiano currently supports:

- Article ingestion from RSS/manual URLs plus markdown upload workflows
- AI enrichment for articles (summary, embeddings, rating, categorization)
- Briefing generation from clustered recent articles
- YouTube transcription ingestion with fallback extraction strategies
- Optional audio generation for articles and transcriptions
- Authenticated user features (users, login, bookmarks)
- Public but token-protected external article submission endpoint

## Architecture at a Glance

### Runtime Layers

| Layer              | Main Responsibility                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------- |
| API                | NestJS controllers under `/api/*` (plus `/` for the root hello endpoint)                  |
| Application/Domain | Services, commands, queries, and use cases in `src/`                                     |
| Async Processing   | BullMQ queues and workers for long-running workflows                                     |
| Infrastructure     | Shared modules in `libs/` (`auth`, `database`, `queue`, `redis`, `s3`, `email`, `audio`) |
| External Systems   | PostgreSQL, Redis, S3, DeepSeek/OpenAI/Together/Groq, Mailgun                            |

### App Composition

`src/app.module.ts` wires:

- Core: `ConfigModule`, `DatabaseModule`, `AuthModule`, `AiModule`
- Domains: `ArticlesModule`, `BriefingsModule`, `BriefingModule`, `YoutubeTranscriptionsModule`, `YoutubeChannelsModule`, `AudioFilesModule`, `UsersModule`, `BookmarksModule`, `ProfilesModule`, `ScraperModule`, `ProcessorModule`
- Infra: `QueueModule`, `S3Module`

Security baseline:

- Global JWT guard (`APP_GUARD` with `JwtAuthGuard`)
- Public routes explicitly marked with `@Public()`
- Redis-backed rate limiting on sensitive/public endpoints

## Key Functional Flows

### Article Flow

1. Article enters via RSS/manual/external endpoints.
2. Article is persisted with base metadata/content.
3. A job is queued to `article-processing`.
4. Worker pipeline performs summary, embedding, rating, and categorization.
5. Optional audio generation can be requested.

### Markdown Article Flow

1. Client requests S3 presigned upload data.
2. Markdown file is uploaded to S3.
3. `markdown-article-processing` job is queued.
4. Worker parses markdown, creates article, and runs enrichment pipeline.

### YouTube Flow

1. Video URL is submitted under `/api/youtube/transcriptions`.
2. Transcript extraction runs with fallbacks.
3. Summary job is queued to `youtube-transcription-summary`.
4. Processed transcription is stored.
5. Optional audio job can be queued.

### Briefing Flow

1. Recent processed articles are loaded.
2. Embeddings are clustered (K-means).
3. Clusters are analyzed with AI.
4. A markdown briefing is synthesized and persisted.

## Async Queues

Current queue names:

- `article-processing`
- `markdown-article-processing`
- `youtube-transcription-summary`
- `audio-generation`

These queues isolate heavier workloads from request/response paths and improve reliability with retries and worker-level error handling.

## API Surface (Current)

### Public Routes

- `GET /`
- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/users`
- `POST /api/articles/external` (requires `X-External-Token`)

### Main Endpoint Groups

- `/api/auth` - login
- `/api/users` - user creation and lookup
- `/api/profiles` - available feed profiles
- `/api/articles` - list/detail/create/delete, markdown flow, jobs, audio enqueue/status
- `/api/articles/external` - public external submission flow
- `/api/briefings` - list/detail
- `/api/youtube/transcriptions` - list/detail/create/delete/audio
- `/api/youtube/channels` - channel configuration management
- `/api/bookmarks` - create/list/delete/check/count

For request/response contracts, use `docs/API_REFERENCE.md`.

## Data and Storage

- Primary database: PostgreSQL (TypeORM-backed migrations in `src/database/migrations`)
- Key entities/tables include articles, briefings, transcriptions, channels, users, bookmarks, and audio files
- Object storage: S3 for markdown and generated audio artifacts
- Redis: queue backend and rate-limit state

## AI Provider Strategy

`AiService` centralizes provider usage:

- Chat/completions: DeepSeek or OpenAI (`ENABLED_CHAT_MODEL`)
- Embeddings: Together API
- Text-to-speech: OpenAI or Groq (`ENABLED_TTS_MODEL`)

Provider choice is configuration-driven, allowing runtime switching without API surface changes.

## Local Development and Operations

### Baseline Commands

- `pnpm run docker:up` - start local PostgreSQL and Redis
- `pnpm run start:dev` - run API in watch mode
- `pnpm run test` - unit tests
- `pnpm run test:e2e` - e2e tests
- `pnpm run migration:run` - run pending migrations

### Runtime Defaults

- Default local API port: `3001`
- API prefix: `/api/*` for most domain routes

## Known Transitional Context

- Runtime persistence is PostgreSQL, but some internals still carry legacy naming from earlier storage approaches.
- Current docs intentionally prioritize behavior as implemented over target-state architecture.

## Related Docs

- `docs/ARCHITECTURE.md` - module and runtime architecture details
- `docs/API_REFERENCE.md` - endpoint-level contracts and examples
- `docs/project/TECHNICAL_OVERVIEW.md` - implementation-oriented technical snapshot

---

Last updated: March 2026

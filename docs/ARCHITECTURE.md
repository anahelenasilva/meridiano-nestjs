# Meridiano Architecture

This document describes the architecture as implemented in the current codebase.

## System View

Meridiano is a modular NestJS backend that ingests content (RSS, manual URLs, YouTube), enriches it with AI, and exposes results through authenticated APIs.

At a high level:

1. HTTP controllers receive requests under `/api/*`.
2. Services and use cases orchestrate domain behavior.
3. Async workloads are pushed to BullMQ queues.
4. Workers process jobs and persist results in PostgreSQL.
5. Files (markdown/audio) are stored in S3, with Redis used for queues and rate limiting.

## Runtime Layers

| Layer | Main Components |
|---|---|
| API | NestJS controllers in `src/*/*.controller.ts` |
| Domain/Application | Services, commands, queries, and use cases in `src/` modules |
| Async Processing | BullMQ queues in `libs/queue` and workers in `libs/queue/processors`, `src/articles/processors`, `src/youtube-transcriptions/processors` |
| Infrastructure | `libs/database`, `libs/redis`, `libs/queue`, `libs/s3`, `libs/email`, `libs/auth`, `libs/audio` |
| External Services | PostgreSQL, Redis, AWS S3, DeepSeek, OpenAI, Together, Groq, Mailgun |

## App Module Composition

`src/app.module.ts` composes the application from:

- `ConfigModule`, `DatabaseModule`, `AuthModule`, `AiModule`
- `ArticlesModule`, `AudioFilesModule`, `BriefingsModule`, `BriefingModule`
- `ProfilesModule`, `ScraperModule`, `ProcessorModule`, `TechModule`
- `YoutubeChannelsModule`, `YoutubeTranscriptionsModule`
- `QueueModule`, `UsersModule`, `BookmarksModule`, `S3Module`

Security baseline:

- Global JWT guard via `APP_GUARD` (`JwtAuthGuard`)
- Public endpoints explicitly marked with `@Public()`

## Domain Modules (`src/`)

| Module | Responsibility |
|---|---|
| `articles` | Article CRUD/list/detail, external ingestion endpoint, markdown upload flow, article audio enqueue |
| `scraper` | URL/RSS scraping and article ingestion |
| `processor` | Article enrichment pipeline (summarize, embedding, rate, categorize) |
| `briefing` | Brief synthesis/orchestration logic |
| `briefings` | Briefing retrieval/listing and briefing-oriented use cases |
| `youtube-transcriptions` | Transcript ingestion, summary flow, transcription audio enqueue |
| `youtube-channels` | Manage YouTube channel configuration |
| `audio-files` | Generate/store audio metadata and S3 references |
| `users` | User creation/read |
| `bookmarks` | User-to-article bookmarking |
| `profiles` | Feed profile access |
| `auth` | Auth API composition around `@libs/auth` |
| `tech` | Technical placeholder module/controller |

## Infrastructure Libraries (`libs/`)

| Library | Responsibility |
|---|---|
| `auth` | JWT auth services/guards/decorators + Redis-backed rate limit utilities |
| `database` | PostgreSQL + TypeORM bootstrapping and migration runner |
| `queue` | Queue definitions, queue service, queue workers |
| `redis` | Shared Redis client |
| `s3` | S3 operations (including presigned upload flow) |
| `email` | Provider-based email sending (`EmailModule.forRoot()`) |
| `audio` | Audio job enqueue/status orchestration (`AudioJobService`) |

## API Surface (Current Controllers)

| Base Path | Controller |
|---|---|
| `/api/auth` | `AuthController` |
| `/api/users` | `UsersController` |
| `/api/bookmarks` | `BookmarksController` |
| `/api/articles` | `ArticlesController` |
| `/api/articles/external` | `ExternalArticlesController` |
| `/api/briefings` | `BriefingsController` |
| `/api/profiles` | `ProfilesController` |
| `/api/youtube` | `YoutubeTranscriptionsController` |
| `/api/youtube/channels` | `YoutubeChannelsController` |
| `/tech` | `TechController` |

## Async Queue Architecture

Defined queue names:

- `article-processing`
- `markdown-article-processing`
- `youtube-transcription-summary`
- `audio-generation`

### Queue Producers

- `ArticlesController` enqueues article and markdown processing jobs.
- `YoutubeTranscriptionsController` and `YoutubeTranscriptionProcessor` can enqueue audio jobs.
- `AudioJobService` handles deduping/locking for audio enqueue.

### Queue Consumers

- `libs/queue/processors/article.processor.ts` consumes `article-processing`
- `src/articles/processors/markdown-article.processor.ts` consumes `markdown-article-processing`
- `src/youtube-transcriptions/processors/youtube-transcription.processor.ts` consumes `youtube-transcription-summary`
- `libs/queue/processors/audio-generation.processor.ts` consumes `audio-generation`

## Core Processing Flows

### Article flow

1. Article submitted manually or via external endpoint.
2. `ScraperService` stores base article data.
3. Job enqueued to `article-processing`.
4. Worker runs process -> rate -> categorize pipeline.
5. Optional audio generation can be requested per article.

### Markdown article flow

1. Client requests S3 upload URL.
2. Markdown file uploaded to S3.
3. Markdown processing job enqueued.
4. Worker downloads markdown, parses, creates article, then runs enrichment pipeline.

### YouTube transcription flow

1. Video submitted to `/api/youtube/transcriptions`.
2. Transcript extraction pipeline runs (primary + fallback services).
3. Summary job enqueued to `youtube-transcription-summary`.
4. Worker generates summary and updates transcription.
5. Optional audio job can be enqueued.

### Briefing generation flow

1. Fetch recent processed articles.
2. Cluster by embeddings.
3. Analyze clusters with AI.
4. Synthesize briefing markdown.
5. Persist briefing and metadata.

## Persistence Model

The system uses PostgreSQL migrations in `src/database/migrations`.

Key tables present in migrations:

- `articles`
- `briefings`
- `youtube_transcriptions`
- `youtube_channels`
- `users`
- `bookmarks`
- `audio_files`
- `telegram_submissions`
- `typeorm_migrations`

Notable schema traits:

- UUID primary keys are in place for core tables.
- `briefings.article_ids` is stored as serialized IDs (no `briefing_articles` join table in current migrations).
- `audio_files` enforces uniqueness by `(source_type, source_id)`.

## AI Provider Architecture

`AiService` centralizes provider clients:

- Chat: DeepSeek or OpenAI (selected by `ENABLED_CHAT_MODEL`)
- Embeddings: Together API
- TTS: OpenAI or Groq (selected by `ENABLED_TTS_MODEL`)

The service handles provider initialization, input sanitization, chunking, retries for transient embedding issues, and fallback selection by configuration.

## Security Architecture

- Global JWT auth guard is enabled application-wide.
- `@Public()` marks unauthenticated routes (for example login and user creation).
- Redis-backed rate limit guard is used on login and external article endpoint.
- External article endpoint includes token guard and SSRF protections (blocked localhost/private IP ranges).

## Configuration Model

Configuration comes from:

1. Environment variables (`.env`, deployment env)
2. `ConfigService` defaults in `src/config/config.service.ts`
3. DB-driven YouTube channel configuration via `YoutubeChannelsService`

Environment toggles are used for behavior such as:

- `ENABLED_CHAT_MODEL`, `ENABLED_TTS_MODEL`
- `TELEGRAM_INTEGRATION_ENABLED`
- Email notification addresses for queue failures

## Current Transitional Notes

- Data access is PostgreSQL-backed, but many services still use a SQLite-style callback/placeholder API through the `DatabaseService` abstraction.
- Some naming in domain code still carries legacy wording (`databaseFile`, old comments, and mixed naming conventions), while runtime storage is PostgreSQL.

---

Last updated: March 2026

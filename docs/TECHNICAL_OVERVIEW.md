# Meridiano - Technical Overview

## Project Summary

Meridiano is a NestJS-based intelligence briefing system that aggregates content from RSS feeds and YouTube channels, processes it with AI, and generates personalized briefings. It uses a queue-based architecture for async processing and supports multiple AI providers.

## Tech Stack

### Core
- **Runtime**: Node.js 22+ with TypeScript
- **Framework**: NestJS 11
- **Database**: PostgreSQL with TypeORM for ORM and migrations
- **Queue**: BullMQ with Redis backend
- **Storage**: AWS S3 for files (markdown articles, audio)

### AI/ML
- **Chat/Summarization**: DeepSeek (primary), OpenAI (alternative)
- **Embeddings**: OpenAI `text-embedding-3-small`
- **Text-to-Speech**: OpenAI TTS, Groq Orpheus

### Auth & Security
- **Authentication**: JWT with Passport.js, bcrypt for passwords
- **Rate Limiting**: Custom guard with Redis-backed tracking

### External Services
- **Email**: Mailgun
- **Feedback issues**: GitHub REST API (`GITHUB_FEEDBACK_TOKEN`, `GITHUB_FEEDBACK_REPO`)
- **Content Extraction**: Mozilla Readability, rss-parser
- **YouTube**: youtube-transcript-plus, youtubei.js

## Project Structure

### Domain Modules (`src/`)
Feature-specific business logic organized by domain:

| Module                    | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `articles/`               | Article CRUD, processing, search                       |
| `briefings/`              | Briefing persistence, generation (clustering, AI), API   |
| `youtube-transcriptions/` | YouTube transcript extraction, listing, and processing |
| `youtube-channels/`       | Channel configuration management                       |
| `users/`                  | User management                                        |
| `bookmarks/`              | Article bookmarking                                    |
| `audio-files/`            | Audio metadata and retrieval support                   |
| `ai/`                     | AI service abstraction layer                           |
| `ask/`                    | Answers a question about one Article or Transcription  |
| `scraper/`                | RSS feed scraping                                      |
| `profiles/`               | Feed profile configuration                             |
| `config/`                 | Application configuration                              |
| `auth/`                   | Login, JWT and API key guards                          |
| `feedback/`               | Files user feedback as a GitHub issue, stores nothing  |

### Infrastructure Libraries (`libs/`)
Reusable cross-cutting concerns:

| Library     | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `database/` | PostgreSQL connection and TypeORM config         |
| `queue/`    | BullMQ queue service and processors              |
| `rate-limit/` | Redis-backed request throttling guard          |
| `redis/`    | Redis client wrapper                             |
| `s3/`       | S3 operations (upload, download, presigned URLs) |
| `email/`    | Email provider abstraction                       |
| `audio/`    | Audio job management                             |

### Key Patterns

**Import Convention**: Use `@libs/*` path alias for infrastructure imports.

**Queue Architecture**: Each heavy operation (article processing, transcription summary, audio generation) has its own queue with dedicated processors. Jobs are added via `QueueService` and processed by processor classes.

**AI Service Abstraction**: Single `AiService`. Application code should call `callChat` for chat completions so the configured provider (`ENABLED_CHAT_MODEL`: DeepSeek or OpenAI) is respected. `callChatModelOrThrow` calls one named provider through its own retry policy, for callers that let the owner pick the model (the Ask panel); `getEmbedding` and `generateAudio` cover other capabilities.

**Briefing Generation Pipeline**:
1. Fetch recent articles with embeddings
2. K-means clustering on embeddings
3. AI analysis per cluster
4. Synthesize final briefing

**YouTube Transcription Fallback Chain**: `TranscriptFetcherService` tries youtube-transcript-plus (`alternative`) → youtubei.js `getTranscript` (`library`) → Innertube caption tracks plus timedtext (`innertube`). The order is wired in `youtube-transcriptions.module.ts`, and the logs name the method that produced each transcript.

## Auth (`src/auth/`)

`AuthModule` serves `POST /api/auth/login`. `AuthService` reads users through `UsersService` and signs a 24h JWT with `JWT_SECRET`.

`JwtAuthGuard` is the global `APP_GUARD` in `app.module.ts`. Routes opt out with `@Public()`, or also accept the `MERIDIANO_API_KEY` static key in the `x-api-key` header with `@ApiKeyAllowed()`. An unset or empty `MERIDIANO_API_KEY` makes the key path inert (JWT only).

After JWT validation `request.user` is `{ id }`. Handlers read it with `@CurrentUser() user: AuthenticatedUser`, never through `@Req()`.

**Static credentials**: `StaticCredential.from(configured)` wraps a secret from env (one string or a list). `check(request, header)` returns `'valid'`, `'missing'` (header absent or blank) or `'invalid'`, and each guard maps that to allow, fall through to JWT, or 401. `verifiedDigest(request, header)` gives the sha256 hex of a matching value, for keys that must not hold the secret. `JwtAuthGuard` (`x-api-key`) and the external articles guards (`x-external-token`) all use it, so there is one constant-time compare.

**Rate limiting**: login uses `RateLimitGuard` from `libs/rate-limit` (5 attempts per 15 minutes per IP). See the Rate Limit Library section in [LIBRARIES.md](./LIBRARIES.md).

## Database Schema

### Core Tables
- `articles` - RSS articles with content, embeddings, impact ratings, categories
- `briefings` - Generated briefings with Markdown content
- `digests` - Immutable snapshots of each daily News Digest run
- `youtube_transcriptions` - Video transcripts with summaries
- `users` - User accounts with hashed passwords
- `bookmarks` - User-article relationships

### Migrations
TypeORM migrations in `src/database/migrations/`. Run via `pnpm run migration:run`.

## API Structure

All endpoints prefixed with `/api/`. Authentication required globally except explicitly marked public routes.

| Endpoint Group                | Key Operations                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/api/auth`                   | Login (public)                                                                                                  |
| `/api/profiles`               | List available feed profiles                                                                                    |
| `/api/articles`               | List/detail/create/delete, markdown upload flow, job status, audio enqueue/status                               |
| `/api/articles/external`      | Public external submission (token-protected, rate-limited)                                                      |
| `/api/audio`                  | Get unified audio library (paginated, newest-generated-first, presigned URLs)                                   |
| `/api/briefings`              | List, get                                                                                                       |
| `/api/youtube/transcriptions` | List, get, process video, delete, audio enqueue                                                                 |
| `/api/youtube/channels`       | List, create, enable/disable                                                                                    |
| `/api/bookmarks`              | Create, list, delete, check, count                                                                              |
| `/api/ask`                    | Answer about one Article or YouTube Transcription, with `history` and `model`; `GET /api/ask/models` lists them |
| `/api/feedback`               | Send feedback (5 an hour per user); opens a GitHub issue labelled `feedback` on `GITHUB_FEEDBACK_REPO`, 503 when it or `GITHUB_FEEDBACK_TOKEN` is unset |
| `/feeds/articles.xml`         | Public RSS feed of Articles (no `/api` prefix, no auth) — see [Nextcloud News setup](./NEXTCLOUD_NEWS_SETUP.md) |

### Unified Audio Library: GET /api/audio

Paginated read of generated audio drawn from Articles and YouTube Transcriptions. Audio-only (every item is playable), ordered newest-generated-first. One presigned S3 URL per item. Query params: `page`, `perPage`.

Response envelope:
```json
{
  "audios": [
    {
      "audio_id": "string",
      "source_type": "article | transcription",
      "source_id": "string",
      "title": "string",
      "source_label": "string",
      "published_at": "string | null",
      "audio": {
        "duration_seconds": "number (optional)",
        "file_size_bytes": "number",
        "presigned_url": "string",
        "created_at": "string"
      }
    }
  ],
  "pagination": {
    "page": "number",
    "per_page": "number",
    "total_pages": "number",
    "total_audios": "number"
  }
}
```

## Configuration

Environment-based via `ConfigService`. Key configs:
- Model config (AI model names, temperature, max tokens)
- App config (scraping limits, briefing parameters)
- Prompt templates with variable interpolation

## Queue Jobs

| Queue                           | Job Data                         |
| ------------------------------- | -------------------------------- |
| `article-processing`            | articleId, feedProfile           |
| `markdown-article-processing`   | s3Key, feedProfile               |
| `youtube-transcription-summary` | transcriptionId, text, title     |
| `audio-generation`              | sourceType, sourceId, text, date |

## Development Commands

The `scripts` in [package.json](../package.json) are the list. The [README](../README.md#run-tests) shows how to run the app, the tests and `test:mutation`.

## Deployment

- Docker Compose with environment profiles (local, staging, production)
- AWS CDK for S3 infrastructure
- Raspberry Pi deployment, reachable over Tailscale — see [Nextcloud News setup](./NEXTCLOUD_NEWS_SETUP.md) for consuming the Articles feed from that environment

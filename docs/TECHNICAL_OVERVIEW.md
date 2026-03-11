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
- **Embeddings**: Together.xyz API
- **Text-to-Speech**: OpenAI TTS, Groq Orpheus

### Auth & Security
- **Authentication**: JWT with Passport.js, bcrypt for passwords
- **Rate Limiting**: Custom guard with Redis-backed tracking

### External Services
- **Email**: Mailgun
- **Content Extraction**: Mozilla Readability, rss-parser
- **YouTube**: youtube-transcript-plus, youtubei.js

## Project Structure

### Domain Modules (`src/`)
Feature-specific business logic organized by domain:

| Module                    | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `articles/`               | Article CRUD, processing, search                       |
| `briefings/`              | Briefing persistence and retrieval                     |
| `briefing/`               | Briefing generation logic (clustering, AI synthesis)   |
| `youtube-transcriptions/` | YouTube transcript extraction, listing, and processing |
| `youtube-channels/`       | Channel configuration management                       |
| `users/`                  | User management                                        |
| `bookmarks/`              | Article bookmarking                                    |
| `audio-files/`            | Audio metadata and retrieval support                   |
| `ai/`                     | AI service abstraction layer                           |
| `scraper/`                | RSS feed scraping                                      |
| `profiles/`               | Feed profile configuration                             |
| `config/`                 | Application configuration                              |
| `auth/`                   | Authentication controller                              |

### Infrastructure Libraries (`libs/`)
Reusable cross-cutting concerns:

| Library     | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `auth/`     | JWT auth module with guards and decorators       |
| `database/` | PostgreSQL connection and TypeORM config         |
| `queue/`    | BullMQ queue service and processors              |
| `redis/`    | Redis client wrapper                             |
| `s3/`       | S3 operations (upload, download, presigned URLs) |
| `email/`    | Email provider abstraction                       |
| `audio/`    | Audio job management                             |

### Key Patterns

**Import Convention**: Use `@libs/*` path alias for infrastructure imports.

**Queue Architecture**: Each heavy operation (article processing, transcription summary, audio generation) has its own queue with dedicated processors. Jobs are added via `QueueService` and processed by processor classes.

**AI Service Abstraction**: Single `AiService` with methods for different providers (`callDeepseekChat`, `callOpenAIChat`, `getEmbedding`, `generateAudio`). Provider selection via config.

**Briefing Generation Pipeline**:
1. Fetch recent articles with embeddings
2. K-means clustering on embeddings
3. AI analysis per cluster
4. Synthesize final briefing

**YouTube Transcription Fallback Chain**: youtube-transcript-plus → custom transcript service → Innertube API

## Database Schema

### Core Tables
- `articles` - RSS articles with content, embeddings, impact ratings, categories
- `briefings` - Generated briefings with Markdown content
- `youtube_transcriptions` - Video transcripts with summaries
- `users` - User accounts with hashed passwords
- `bookmarks` - User-article relationships

### Migrations
TypeORM migrations in `src/database/migrations/`. Run via `pnpm run migration:run`.

## API Structure

All endpoints prefixed with `/api/`. Authentication required globally except explicitly marked public routes.

| Endpoint Group                | Key Operations                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `/api/auth`                   | Login (public)                                                                    |
| `/api/users`                  | Create user (public), get user                                                    |
| `/api/profiles`               | List available feed profiles                                                      |
| `/api/articles`               | List/detail/create/delete, markdown upload flow, job status, audio enqueue/status |
| `/api/articles/external`      | Public external submission (token-protected, rate-limited)                        |
| `/api/briefings`              | List, get                                                                         |
| `/api/youtube/transcriptions` | List, get, process video, delete, audio enqueue                                   |
| `/api/youtube/channels`       | List, create, enable/disable                                                      |
| `/api/bookmarks`              | Create, list, delete, check, count                                                |

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

- `pnpm run start:dev` - Development server
- `pnpm run test` - Unit tests
- `pnpm run test:e2e` - E2E tests
- `pnpm run docker:up` - Start PostgreSQL and Redis
- `pnpm run migration:run` - Run database migrations
- `pnpm run briefing:tech` - Generate tech briefing
- `pnpm run yt-transcript` - Extract YouTube transcripts

## Deployment

- Docker Compose with environment profiles (local, staging, production)
- AWS CDK for S3 infrastructure
- Railway deployment supported

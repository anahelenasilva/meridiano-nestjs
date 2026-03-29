# Meridiano Project Documentation Index

Welcome to the comprehensive documentation for **Meridiano** - Your Personal Intelligence Briefing System.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Architecture Overview](#architecture-overview)
3. [Project Structure](#project-structure)
4. [Domain Modules](#domain-modules)
5. [Infrastructure Libraries](#infrastructure-libraries)
6. [API Documentation](#api-documentation)
7. [Development Guides](#development-guides)
8. [Deployment](#deployment)
9. [Additional Resources](#additional-resources)

---

## 🚀 Getting Started

### Quick Start
- **[Main README](../README.md)** - Project overview, setup instructions, and environment configuration
- **[Developer Guide](DEVELOPER_GUIDE.md)** - Comprehensive development guide
- **[API Reference](API_REFERENCE.md)** - Complete API documentation
- **[Architecture Guide](ARCHITECTURE.md)** - System architecture and design patterns
- **[Libraries Guide](LIBRARIES.md)** - Infrastructure library documentation
- **[Environment Setup](features/opencode/OPENCODE_SETUP.md)** - OpenCode-specific setup instructions
- **[Quick Reference](QUICK_REFERENCE.md)** - Common commands and shortcuts

### Prerequisites
- Node.js 22+ (see `.nvmrc`)
- pnpm 10
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Initial Setup
```bash
# Clone and install
git clone <repo_url> meridiano-nestjs
cd meridiano-nestjs
pnpm install

# Environment configuration
cp .env.sample .env
# Edit .env with your API keys and configuration

# Start infrastructure
pnpm run docker:up

# Build and run migrations
pnpm run build
pnpm run migration:run

# Start development server
pnpm run start:dev
```

---

## 🏗️ Architecture Overview

For detailed architecture documentation including data flow diagrams, component interactions, and design patterns, see **[Architecture Guide](ARCHITECTURE.md)**.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Meridiano Architecture                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│  │   API Layer  │────▶│  Queue Jobs  │────▶│  Processors  │             │
│  │  (NestJS)    │     │   (BullMQ)   │     │  (Workers)   │             │
│  └──────────────┘     └──────────────┘     └──────────────┘             │
│         │                                              │                 │
│         ▼                                              ▼                 │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                     Domain Modules (src/)                     │       │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────────┐  │       │
│  │  │Articles │ │Briefings │ │ YouTube     │ │  Bookmarks   │  │       │
│  │  │         │ │          │ │Transcriptions│ │              │  │       │
│  │  └─────────┘ └──────────┘ └─────────────┘ └──────────────┘  │       │
│  └──────────────────────────────────────────────────────────────┘       │
│         │                                              │                 │
│         ▼                                              ▼                 │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │               Infrastructure Libraries (libs/)                │       │
│  │  ┌────────┐ ┌──────────┐ ┌───────┐ ┌───────┐ ┌──────────┐   │       │
│  │  │Database│ │   Auth   │ │ Queue │ │ Redis │ │   S3     │   │       │
│  │  └────────┘ └──────────┘ └───────┘ └───────┘ └──────────┘   │       │
│  └──────────────────────────────────────────────────────────────┘       │
│         │                                              │                 │
│         ▼                                              ▼                 │
│  ┌──────────────────────────────────────────────────────────────┐       │
│  │                    External Services                          │       │
│  │  PostgreSQL    Redis    AWS S3    DeepSeek    OpenAI        │       │
│  └──────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core Workflows

#### Article Processing Pipeline
```
RSS Feed → Scraper → Article Queue → Processor → AI Analysis → Database
                                              ↓
                                        Embeddings Generation
                                              ↓
                                        Clustering for Briefings
```

#### YouTube Transcription Flow
```
YouTube URL → Transcript Extraction → Summary Queue → AI Summary → Database
                                            ↓
                                    Audio Generation (optional)
```

### Key Design Patterns

1. **Modular Architecture**: Clear separation between domain logic (`src/`) and infrastructure (`libs/`)
2. **Queue-Based Processing**: Heavy operations are offloaded to background jobs
3. **AI Provider Abstraction**: Support for multiple AI providers with fallback capabilities
4. **Configuration-Driven**: Extensive use of environment variables and profile-based configs

---

## 📁 Project Structure

```
meridiano-nestjs/
├── src/                          # Domain modules (business logic)
│   ├── articles/                 # Article CRUD and processing
│   ├── audio-files/              # Audio file management
│   ├── auth/                     # Authentication controller
│   ├── bookmarks/                # Article bookmarking system
│   ├── briefings/                # Briefing generation, persistence, API
│   ├── config/                   # Application configuration
│   ├── database/                 # Database entities and migrations
│   ├── processor/                # Job processors
│   ├── profiles/                 # Feed profile configurations
│   ├── scraper/                  # RSS feed scraping
│   ├── scripts/                  # CLI scripts
│   ├── shared/                   # Shared utilities
│   ├── users/                    # User management
│   ├── youtube-channels/         # YouTube channel config
│   ├── youtube-transcriptions/   # YouTube transcript handling
│   ├── ai/                       # AI service abstraction
│   ├── app.module.ts             # Root module
│   └── main.ts                   # Application entry point
│
├── libs/                         # Infrastructure libraries
│   ├── auth/                     # JWT authentication
│   ├── database/                 # Database connection
│   ├── email/                    # Email service
│   ├── queue/                    # BullMQ queue management
│   ├── redis/                    # Redis client
│   ├── s3/                       # AWS S3 operations
│   └── audio/                    # Audio job management
│
├── docs/                         # Documentation
│   ├── project/                  # Project documentation
│   ├── features/                 # Feature docs (auth, bookmarks, plans, opencode, etc.)
│   └── project/                  # High-level project overviews
│
├── bruno-collections/            # API testing collections
├── infrastructure/               # AWS CDK infrastructure
├── scripts/                      # Utility scripts
├── prompts/                      # AI prompts configuration
├── test/                         # E2E tests
└── docker-compose.yml            # Docker services
```

---

## 🔧 Domain Modules

### Articles Module (`src/articles/`)
**Purpose**: Core article management and processing

**Key Components**:
- `articles.controller.ts` - REST API endpoints
- `articles.service.ts` - Business logic
- `articles.repository.ts` - Data access
- `entities/article.entity.ts` - Database entity

**Features**:
- RSS feed scraping with Mozilla Readability
- Manual article addition via URL
- Markdown file upload to S3
- Full-text search and filtering
- Impact rating (1-10 scale)
- Category classification
- Related articles suggestions

**API Endpoints**:
- `GET /api/articles` - List articles with pagination
- `GET /api/articles/:id` - Get single article
- `POST /api/articles/upload-url` - Generate presigned URL
- `POST /api/articles/process-markdown` - Process markdown file

---

### Briefings Module (`src/briefings/`)
**Purpose**: Intelligence briefing persistence, generation, and HTTP API

**Key Components**:
- `briefings.service.ts` - Read/write `briefings` table
- `services/briefing-generation.service.ts` - K-means clustering and AI synthesis
- `entities/briefing.entity.ts` - Types for briefing metadata and generation results
- `queries/list-briefings.query.ts` - List briefings for the API
- `briefings.controller.ts` - REST endpoints under `/api/briefings`
- `usecases/` - Orchestration (run pipeline, generate brief, scrape, etc.)

**Features**:
- K-means clustering on article embeddings
- AI-powered cluster analysis and synthesis
- Profile-specific briefings via `ProfilesService`
- Configurable lookback periods

**CLI Commands**:
```bash
pnpm run briefing:tech      # Generate tech briefing
pnpm run briefing:brasil    # Generate Brazil briefing
pnpm run briefing:teclas    # Generate Teclas briefing
```

---

### YouTube Transcriptions Module (`src/youtube-transcriptions/`)
**Purpose**: YouTube video transcription and processing

**Key Components**:
- `youtube-transcriptions.controller.ts` - API endpoints
- `youtube-transcriptions.service.ts` - Business logic
- `transcript-extraction.service.ts` - Multi-method transcript extraction

**Features**:
- Multi-method transcript extraction (fallback chain)
- AI-generated summaries
- Optional audio generation
- Channel-based organization

**Transcript Extraction Chain**:
1. Primary: `youtube-transcript-plus` library
2. Secondary: Custom transcript service
3. Tertiary: Innertube API method

**CLI Commands**:
```bash
pnpm run yt-transcript              # Extract transcripts
pnpm run process-transcriptions     # Process pending transcriptions
pnpm run list-transcriptions        # List existing transcriptions
```

---

### Bookmarks Module (`src/bookmarks/`)
**Purpose**: Article bookmarking system

**Key Components**:
- `bookmarks.controller.ts` - API endpoints
- `bookmarks.service.ts` - Business logic
- `entities/bookmark.entity.ts` - Database entity

**Features**:
- Save articles for later reading
- Paginated bookmark lists
- Bookmark status checking
- Bookmark count tracking

**API Endpoints**:
- `POST /api/bookmarks` - Create bookmark
- `GET /api/bookmarks` - List bookmarks
- `DELETE /api/bookmarks/:id` - Remove bookmark
- `GET /api/bookmarks/check` - Check bookmark status
- `GET /api/bookmarks/count` - Get bookmark count

**Documentation**: [Bookmarks API](features/bookmarks/BOOKMARKS_API.md)

---

### Audio Files Module (`src/audio-files/`)
**Purpose**: Audio generation and management

**Key Components**:
- `audio-files.controller.ts` - API endpoints
- `audio-files.service.ts` - Business logic

**Features**:
- Text-to-speech generation
- Multiple TTS providers (OpenAI, Groq)
- Background job processing
- S3 storage for audio files

**TTS Providers**:
- **OpenAI TTS**: alloy, echo, fable, onyx, nova, shimmer
- **Groq Orpheus**: autumn, diana, hannah, austin, daniel, troy

**API Endpoints**:
- `POST /api/audio-files/generate` - Generate audio

---

### Users Module (`src/users/`)
**Purpose**: User management

**Key Components**:
- `users.controller.ts` - API endpoints
- `users.service.ts` - Business logic
- `entities/user.entity.ts` - Database entity

**Features**:
- User registration
- UUID-based primary keys
- Username validation
- Password hashing with bcrypt

**API Endpoints**:
- `POST /api/users` - Create user

---

### Scraper Module (`src/scraper/`)
**Purpose**: RSS feed scraping

**Key Components**:
- `scraper.service.ts` - RSS scraping logic
- `rss-feed.service.ts` - Feed configuration

**Features**:
- Scheduled RSS feed scraping
- Content extraction with Mozilla Readability
- Duplicate prevention by URL
- Configurable maximum articles per feed
- Open Graph and RSS enclosure image capture

---

### Config Module (`src/config/`)
**Purpose**: Application configuration management

**Key Components**:
- `config.service.ts` - Configuration service
- `model.config.ts` - AI model configuration
- `app.config.ts` - Application configuration
- `prompt.config.ts` - AI prompt templates

**Configuration Categories**:
- Model config (AI providers, temperatures, max tokens)
- App config (scraping limits, briefing parameters)
- Prompt templates with variable interpolation

---

### AI Module (`src/ai/`)
**Purpose**: AI service abstraction layer

**Key Components**:
- `ai.service.ts` - Unified AI service

**Features**:
- DeepSeek chat completions
- OpenAI chat and TTS
- Groq TTS (Orpheus model)
- Together.xyz embeddings
- Provider selection via configuration

---

## 🏛️ Infrastructure Libraries

For detailed documentation on all infrastructure libraries including setup, usage examples, and API references, see **[Libraries Guide](LIBRARIES.md)**.

### Auth Library (`libs/auth/`)
**Purpose**: JWT-based authentication infrastructure

**Exports**:
- `AuthModule` - NestJS module with `forRoot()`/`forRootAsync()`
- `AuthService` - Authentication and token generation
- `JwtAuthGuard` - Route protection guard
- `Public` decorator - Public route marker
- `LoginDto` / `LoginResponseDto` - DTOs

**Usage**:
```typescript
import { AuthModule, JwtAuthGuard, Public } from '@libs/auth';

@Module({
  imports: [AuthModule.forRootAsync({...})],
})
export class AppModule {}
```

---

### Database Library (`libs/database/`)
**Purpose**: PostgreSQL connection and TypeORM configuration

**Exports**:
- `DatabaseModule` - Database connection module
- `DatabaseService` - Database operations
- `AbstractDatabaseService` - Abstract base class
- `PostgresDatabaseService` - PostgreSQL implementation
- `TypeORM config` - Migration configuration

**Features**:
- Automatic migrations on startup
- Connection pooling
- TypeORM entity support

---

### Queue Library (`libs/queue/`)
**Purpose**: BullMQ-based job queue infrastructure

**Exports**:
- `QueueModule` - Queue infrastructure module
- `QueueService` - Job management service
- Queue constants (`ARTICLE_PROCESSING_QUEUE`, etc.)
- Job data interfaces
- `ArticleProcessor` - Infrastructure processor

**Queues**:
- `article-processing` - Article content processing
- `markdown-article-processing` - Markdown file processing
- `youtube-transcription-summary` - Transcription summarization
- `audio-generation` - Audio generation jobs

**Usage**:
```typescript
import { QueueService, ARTICLE_PROCESSING_QUEUE } from '@libs/queue';

const job = await queueService.addArticleProcessingJob(articleId, feedProfile);
```

---

### S3 Library (`libs/s3/`)
**Purpose**: AWS S3 operations

**Exports**:
- `S3Module` - S3 integration module
- `S3Service` - S3 operations service

**Methods**:
- `downloadMarkdownFile(bucket, key)` - Download files
- `generatePresignedPostUrl(bucket, key)` - Upload URLs
- `generatePresignedGetUrl(bucket, key, expiresIn)` - Download URLs

---

### Email Library (`libs/email/`)
**Purpose**: Email service abstraction

**Exports**:
- `EmailModule` - Email module with `forRoot()`
- `EmailService` - Email sending service

**Supported Providers**:
- Mailgun (default)

---

### Redis Library (`libs/redis/`)
**Purpose**: Redis client connection

**Exports**:
- `RedisModule` - Redis module
- `RedisService` - Redis client service

**Methods**:
- `getClient()` - Get Redis client instance

---

### Audio Library (`libs/audio/`)
**Purpose**: Audio job management

**Exports**:
- `AudioModule` - Audio module
- `AudioJobService` - Audio job service

---

## 📡 API Documentation

For complete API documentation including all endpoints, request/response schemas, and examples, see **[API Reference](API_REFERENCE.md)**.

### Authentication
All endpoints require authentication except those marked with `@Public()` decorator.

**Login**:
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username"
  }
}
```

### API Collections
Test collections available in [`bruno-collections/`](../bruno-collections/):
- Authentication endpoints
- Articles endpoints
- Users endpoints
- YouTube channels
- YouTube transcriptions

### Complete API Reference

| Endpoint Group | Description | Documentation |
|----------------|-------------|---------------|
| `/api/auth` | Authentication | [Auth Guide](features/auth/AUTH_IMPLEMENTATION.md) |
| `/api/articles` | Article management | See module docs |
| `/api/briefings` | Briefing retrieval | See module docs |
| `/api/youtube/transcriptions` | Transcription management | See module docs |
| `/api/youtube/channels` | Channel configuration | See module docs |
| `/api/bookmarks` | Bookmark management | [Bookmarks API](features/bookmarks/BOOKMARKS_API.md) |
| `/api/audio-files` | Audio generation | See module docs |
| `/api/users` | User management | See module docs |

---

## 🛠️ Development Guides

For a comprehensive development guide including setup, workflows, testing, and troubleshooting, see **[Developer Guide](DEVELOPER_GUIDE.md)**.

### Database Migrations

```bash
# Create a new migration
pnpm run migration:create src/database/migrations/MigrationName

# Generate migration from entity changes
pnpm run migration:generate src/database/migrations/UpdateSchema

# Run pending migrations
pnpm run migration:run

# Revert last migration
pnpm run migration:revert
```

### Running Tests

```bash
# Unit tests
pnpm run test

# Watch mode
pnpm run test:watch

# Coverage
pnpm run test:cov

# E2E tests
pnpm run test:e2e
```

### Code Quality

```bash
# Lint and fix
pnpm run lint

# Format code
pnpm run format
```

### Docker Operations

```bash
# Start services
pnpm run docker:up

# View logs
pnpm run docker:logs

# Stop services
pnpm run docker:down
```

### Workflow Guides

- **[Cursor + OpenCode Workflow](features/opencode/CURSOR_OPENCODE_WORKFLOW.md)** - Using Cursor and OpenCode together
- **[Auth Implementation](features/auth/AUTH_IMPLEMENTATION.md)** - Authentication setup guide
- **[Bookmarks Guide](features/bookmarks/BOOKMARKS_QUICK_START.md)** - Bookmarks feature quick start

---

## 🚀 Deployment

### Docker Deployment
```bash
# Production profile
COMPOSE_PROFILE=production pnpm run docker:up

# Staging profile
COMPOSE_PROFILE=staging docker-compose --profile staging up -d
```

### AWS Infrastructure
Infrastructure as code using AWS CDK in [`infrastructure/`](../infrastructure/):
- S3 bucket configuration
- Deployment scripts for dev/staging/prod

### Railway Deployment
Railway configuration in [`railway.json`](../railway.json)

---

## 📚 Additional Resources

### Implementation Plans
Detailed implementation plans in [`docs/features/plans/`](features/plans/):
- [Telegram Article Submission](features/plans/telegram_article_submission_feature.tdd.md)
- [Audio Generation Job Module Refactor](features/plans/audio_generation_job_module_refactor.plan.md)
- [Article Processing with BullMQ](features/plans/bullmq_article_processing_3bd588bf.plan.md)
- [PostgreSQL & Migrations Setup](features/plans/postgresql_docker_&_migrations_setup_3e0ef2b3.plan.md)

### Ralph - Autonomous Coding Agent
Ralph is an autonomous coding agent that implements user stories iteratively:
- **[Ralph Documentation](../scripts/ralph/README.md)**
- **[Ralph Script](../scripts/ralph/ralph.ts)**

### BMAD + Linear Integration
Sprint planning with optional Linear issue sync:
- Custom workflow configuration in `_bmad/custom/`
- Command: `/bmad-bmm-sprint-planning`

---

## 🔗 Quick Links

| Resource | Location |
|----------|----------|
| Main README | [../README.md](../README.md) |
| **Project Documentation Index** | **[PROJECT_DOCUMENTATION_INDEX.md](./PROJECT_DOCUMENTATION_INDEX.md)** |
| Developer Guide | [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) |
| API Reference | [API_REFERENCE.md](./API_REFERENCE.md) |
| Architecture Guide | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Libraries Guide | [LIBRARIES.md](./LIBRARIES.md) |
| Project Overview | [project/PROJECT_OVERVIEW.md](project/PROJECT_OVERVIEW.md) |
| Technical Overview | [project/TECHNICAL_OVERVIEW.md](project/TECHNICAL_OVERVIEW.md) |
| Libs Documentation | [../libs/README.md](../libs/README.md) |
| API Collections | [../bruno-collections/](../bruno-collections/) |
| Environment Sample | [../.env.sample](../.env.sample) |

---

## 🤝 Contributing

1. Create a feature branch
2. Follow conventional commit messages
3. Run tests and linting
4. Submit a PR for review

See [Project Overview](project/PROJECT_OVERVIEW.md) for detailed workflow information.

---

*Last updated: March 2026*

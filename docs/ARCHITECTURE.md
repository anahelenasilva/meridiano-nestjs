# Meridiano Architecture Documentation

This document provides a comprehensive overview of the Meridiano system architecture, including data flow diagrams, component interactions, and design decisions.

---

## 📐 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Meridiano System Architecture                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                         Client Layer                                   │   │
│   │   (Web Interface / Mobile / API Consumers)                             │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                      API Gateway Layer (NestJS)                        │   │
│   │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │   │
│   │   │   Auth      │ │   Articles  │ │  Bookmarks  │ │   YouTube       │  │   │
│   │   │ Controller  │ │ Controller  │ │ Controller  │ │  Controller     │  │   │
│   │   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                      Application Services Layer                        │   │
│   │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │   │
│   │   │  Articles   │ │  Briefing   │ │  Scraper    │ │    AI Service   │  │   │
│   │   │   Service   │ │   Service   │ │   Service   │ │                 │  │   │
│   │   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        Queue Workers Layer                             │   │
│   │   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐  │   │
│   │   │ Article Proc.   │ │  Transcription  │ │   Audio Generation      │  │   │
│   │   │   Processor     │ │   Processor     │ │     Processor           │  │   │
│   │   └─────────────────┘ └─────────────────┘ └─────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                     Infrastructure Services Layer                      │   │
│   │   ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌────────────────┐ │   │
│   │   │ Database │ │  Queue   │ │  Redis  │ │   S3    │ │     Email      │ │   │
│   │   │  Service │ │  Service │ │ Service │ │ Service │ │    Service     │ │   │
│   │   └──────────┘ └──────────┘ └─────────┘ └─────────┘ └────────────────┘ │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│                                      ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                        External Services                               │   │
│   │   ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌────────────────┐ │   │
│   │   │PostgreSQL│ │  Redis   │ │AWS S3   │ │DeepSeek │ │    OpenAI      │ │   │
│   │   └──────────┘ └──────────┘ └─────────┘ └─────────┘ └────────────────┘ │   │
│   │   ┌──────────┐ ┌──────────┐ ┌─────────┐                                  │   │
│   │   │  Groq    │ │ Together │ │ Mailgun │                                  │   │
│   │   └──────────┘ └──────────┘ └─────────┘                                  │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### Article Processing Pipeline

```
┌──────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  RSS     │────▶│ Scraper  │────▶│    Queue     │────▶│  Processor   │
│  Feed    │     │  Service │     │   (BullMQ)   │     │   Worker     │
└──────────┘     └──────────┘     └──────────────┘     └──────┬───────┘
                                                              │
                                   ┌──────────────────────────┼──────────┐
                                   │                          ▼          │
                                   │  ┌──────────┐    ┌──────────────┐   │
                                   │  │  Extract │───▶│    Store     │   │
                                   │  │  Content │    │   Raw Data   │   │
                                   │  └──────────┘    └──────────────┘   │
                                   │                                     │
                                   │  ┌──────────┐    ┌──────────────┐   │
                                   │  │  AI      │───▶│   Generate   │   │
                                   │  │ Summarize│    │  Embeddings  │   │
                                   │  └──────────┘    └──────────────┘   │
                                   │                                     │
                                   │  ┌──────────┐    ┌──────────────┐   │
                                   │  │  Rate    │───▶│   Save to    │   │
                                   │  │  Impact  │    │   Database   │   │
                                   │  └──────────┘    └──────────────┘   │
                                   │                                     │
                                   └─────────────────────────────────────┘
```

**Flow Description**:
1. **RSS Feed** → Scraper polls configured feeds
2. **Scraper Service** → Extracts URLs, checks for duplicates
3. **Queue** → Jobs added to BullMQ for async processing
4. **Processor Worker** → Executes pipeline stages:
   - Extract content with Mozilla Readability
   - Generate AI summary using DeepSeek/OpenAI
   - Create embeddings using Together.xyz
   - Rate impact (1-10) with AI
   - Classify category
   - Store processed article in PostgreSQL

---

### YouTube Transcription Flow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   YouTube    │────▶│  Transcript      │────▶│    Queue     │
│     URL      │     │  Extraction      │     │   (BullMQ)   │
└──────────────┘     └──────────────────┘     └──────┬───────┘
                                                      │
                    ┌─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Transcript Extraction Chain                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │  youtube-       │───▶│ Custom Service  │───▶│  Innertube  │ │
│  │  transcript-plus│    │    (Fallback)   │    │    API      │ │
│  │   (Primary)     │    │   (Secondary)   │    │  (Tertiary) │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
            ┌──────────────┐
            │    Queue     │
            │   Summary    │
            └──────┬───────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Processing Pipeline                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │   AI     │───▶│  Store   │───▶│  Audio   │───▶│  Save    │  │
│  │ Summary  │    │  Summary │    │ Generate │    │  Audio   │  │
│  └──────────┘    └──────────┘    │(Optional)│    │  to S3   │  │
│                                  └──────────┘    └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Extraction Chain**:
1. **Primary**: `youtube-transcript-plus` library
2. **Secondary**: Custom transcript service
3. **Tertiary**: Innertube API method

**Processing Stages**:
1. Extract video metadata (title, thumbnail, date)
2. Get transcript using fallback chain
3. Queue for AI summarization
4. Optional: Queue for audio generation
5. Store results in PostgreSQL

---

### Briefing Generation Flow

```
┌──────────────┐
│   Trigger    │ (CLI Command / Schedule)
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Briefing Generation Pipeline              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. FETCH                                                    │
│     ┌────────────┐                                          │
│     │  Query DB  │──▶ Recent articles (24-48h)             │
│     │            │    with embeddings                       │
│     └────────────┘                                          │
│                                                              │
│  2. CLUSTER                                                  │
│     ┌────────────┐     ┌────────────┐                      │
│     │  K-Means   │──▶  │  Groups of │                      │
│     │  Algorithm │     │  related   │                      │
│     │  (ml-kmeans)     │  articles  │                      │
│     └────────────┘     └────────────┘                      │
│                                                              │
│  3. ANALYZE                                                  │
│     ┌────────────┐                                          │
│     │    AI      │──▶  Topics per cluster                   │
│     │  Analysis  │     Key insights                          │
│     └────────────┘                                          │
│                                                              │
│  4. SYNTHESIZE                                               │
│     ┌────────────┐                                          │
│     │  Generate  │──▶  Markdown briefing                     │
│     │  Briefing  │     with citations                        │
│     └────────────┘                                          │
│                                                              │
│  5. STORE                                                    │
│     ┌────────────┐                                          │
│     │  Save to   │──▶  Briefing + Article references         │
│     │    DB      │                                          │
│     └────────────┘                                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### Audio Generation Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Request    │────▶│  Validate    │────▶│   Check for      │
│  (Article/   │     │   Input      │     │ Existing Audio   │
│Transcription)│     │              │     │                  │
└──────────────┘     └──────────────┘     └────────┬─────────┘
                                                   │
                              ┌────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   Queue Job      │
                    │  (BullMQ Audio)  │
                    └────────┬─────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Audio Generation Worker                       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   Text Preparation                          │  │
│  │  - Prefer processed_content / summary                       │  │
│  │  - Fallback to raw_content / transcript                     │  │
│  │  - Chunk if exceeds provider limits                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  TTS Provider Selection                     │  │
│  │  ┌────────────┐    ┌────────────┐                         │  │
│  │  │ OpenAI TTS │ or │ Groq       │                         │  │
│  │  │            │    │ Orpheus    │                         │  │
│  │  │ Voices:    │    │ Voices:    │                         │  │
│  │  │ alloy,echo │    │ autumn,    │                         │  │
│  │  │ fable,onyx │    │ diana,     │                         │  │
│  │  │ nova,      │    │ hannah...  │                         │  │
│  │  │ shimmer    │    │            │                         │  │
│  │  └────────────┘    └────────────┘                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                  Upload & Store                             │  │
│  │  - Upload to S3                                             │  │
│  │  - Generate presigned URL                                   │  │
│  │  - Save metadata to DB                                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Component Architecture

### Domain Modules (`src/`)

```
src/
├── articles/
│   ├── articles.controller.ts      # REST API endpoints
│   ├── articles.service.ts         # Business logic
│   ├── articles.repository.ts      # Data access
│   ├── entities/
│   │   └── article.entity.ts       # Database entity
│   ├── dto/
│   │   ├── create-article.dto.ts   # Input validation
│   │   └── ...
│   └── processors/
│       └── markdown.processor.ts   # Job processor
│
├── bookmarks/
│   ├── bookmarks.controller.ts     # REST API endpoints
│   ├── bookmarks.service.ts        # Business logic
│   └── entities/
│       └── bookmark.entity.ts      # Database entity
│
├── briefing/                       # Briefing generation
│   ├── briefing.service.ts         # Orchestration logic
│   └── clustering.service.ts       # K-means clustering
│
├── briefings/                      # Briefing persistence
│   ├── briefings.controller.ts     # REST API endpoints
│   └── briefings.service.ts        # CRUD operations
│
├── youtube-transcriptions/
│   ├── youtube-transcriptions.controller.ts
│   ├── youtube-transcriptions.service.ts
│   ├── transcript-extraction.service.ts
│   └── processors/
│       └── transcription.processor.ts
│
└── [other modules...]
```

### Infrastructure Libraries (`libs/`)

```
libs/
├── auth/
│   ├── auth.module.ts              # NestJS module
│   ├── auth.service.ts             # JWT token generation
│   ├── guards/
│   │   └── jwt-auth.guard.ts       # Route protection
│   ├── strategies/
│   │   └── jwt.strategy.ts         # Passport strategy
│   └── decorators/
│       └── public.decorator.ts     # Public route marker
│
├── database/
│   ├── database.module.ts          # TypeORM module
│   ├── database.service.ts         # Connection management
│   └── typeorm.config.ts           # Migration config
│
├── queue/
│   ├── queue.module.ts             # BullMQ module
│   ├── queue.service.ts            # Job management
│   ├── constants/
│   │   └── queue.constants.ts      # Queue names
│   └── processors/
│       └── article.processor.ts    # Article job processor
│
├── s3/
│   ├── s3.module.ts
│   └── s3.service.ts               # S3 operations
│
├── redis/
│   ├── redis.module.ts
│   └── redis.service.ts            # Redis client
│
├── email/
│   ├── email.module.ts
│   ├── email.service.ts
│   └── providers/
│       └── mailgun.provider.ts
│
└── audio/
    ├── audio.module.ts
    └── services/
        └── audio-job.service.ts    # Audio job management
```

---

## 🔌 Module Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                    Module Dependency Graph                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────┐                                              │
│  │   AppModule   │◄──────────────────────────────────┐         │
│  └───────┬───────┘                                   │         │
│          │ imports                                    │         │
│          ▼                                           │         │
│  ┌────────────────────────────────────────────────┐  │         │
│  │              Feature Modules                    │  │         │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────────┐     │  │         │
│  │  │Articles │ │Bookmarks │ │   Briefing  │─────┼──┘         │
│  │  │ Module  │ │  Module  │ │   Module    │     │            │
│  │  └────┬────┘ └────┬─────┘ └─────────────┘     │            │
│  │       │           │                           │            │
│  │  ┌────┴───────────┴───────────────────────┐   │            │
│  │  │           Infrastructure Libs           │   │            │
│  │  │  ┌────────┐ ┌────────┐ ┌──────────┐    │   │            │
│  │  │  │ Queue  │ │Database│ │   S3     │    │   │            │
│  │  │  │Module  │ │Module  │ │ Module   │    │   │            │
│  │  │  └───┬────┘ └────┬───┘ └────┬─────┘    │   │            │
│  │  │      │           │          │          │   │            │
│  │  │      └───────────┴──────────┘          │   │            │
│  │  │                  │                     │   │            │
│  │  │           ┌──────┴──────┐              │   │            │
│  │  │           │  Database   │              │   │            │
│  │  │           │   Module    │              │   │            │
│  │  │           └──────┬──────┘              │   │            │
│  │  │                  │                     │   │            │
│  │  │           ┌──────┴──────┐              │   │            │
│  │  │           │   Redis     │              │   │            │
│  │  │           │   Module    │              │   │            │
│  │  │           └─────────────┘              │   │            │
│  │  └────────────────────────────────────────┘   │            │
│  └────────────────────────────────────────────────┘            │
│                                                                  │
│  Key: ───► depends on / imports                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     users       │         │   bookmarks     │         │    articles     │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ PK id (uuid)    │◄────────┤ PK id (uuid)    ├────────►│ PK id (uuid)    │
│    email        │    ┌────┤ FK user_id      │         │    title        │
│    username     │    │    │ FK article_id   │         │    url          │
│    password_hash│    │    │    created_at   │         │    source       │
│    created_at   │    │    └─────────────────┘         │    raw_content  │
└─────────────────┘    │                                │    processed_...│
                       │                                │    embedding    │
                       │                                │    impact       │
                       │                                │    category     │
                       │                                │    feed_profile │
                       │                                │    published_...│
                       │                                │    created_at   │
                       │                                └─────────────────┘
                       │
                       │         ┌─────────────────┐
                       │         │  briefings      │
                       │         ├─────────────────┤
                       │         │ PK id (uuid)    │
                       └────────►│    title        │
                                 │    content      │
                                 │    feed_profile │
                                 │    created_at   │
                                 └─────────────────┘
                                          │
                                          │
                                 ┌────────┴────────┐
                                 │briefing_articles│
                                 ├─────────────────┤
                                 │ FK briefing_id  │
                                 │ FK article_id   │
                                 └─────────────────┘

┌─────────────────────────┐
│ youtube_transcriptions  │
├─────────────────────────┤
│ PK id (uuid)            │
│    video_id             │
│    channel_id           │
│    channel_name         │
│    title                │
│    thumbnail_url        │
│    posted_at            │
│    transcription_text   │
│    transcription_summary│
│    created_at           │
└─────────────────────────┘

┌─────────────────────────┐
│    youtube_channels     │
├─────────────────────────┤
│ PK channel_id           │
│    name                 │
│    url                  │
│    description          │
│    enabled              │
│    max_videos           │
│    created_at           │
└─────────────────────────┘

┌─────────────────────────┐
│     audio_files         │
├─────────────────────────┤
│ PK id (uuid)            │
│    source_type          │
│    source_id            │
│    s3_bucket            │
│    s3_key               │
│    presigned_url        │
│    presigned_expires_at │
│    created_at           │
└─────────────────────────┘
```

### Table Descriptions

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | User accounts | `id`, `email`, `username`, `password_hash` |
| `articles` | RSS articles | `id`, `title`, `url`, `embedding`, `impact`, `category` |
| `bookmarks` | User bookmarks | `id`, `user_id`, `article_id` |
| `briefings` | Generated briefings | `id`, `title`, `content`, `feed_profile` |
| `briefing_articles` | Many-to-many join | `briefing_id`, `article_id` |
| `youtube_transcriptions` | Video transcripts | `id`, `video_id`, `transcription_text`, `summary` |
| `youtube_channels` | Channel config | `channel_id`, `name`, `enabled`, `max_videos` |
| `audio_files` | Audio metadata | `id`, `source_type`, `source_id`, `s3_key` |

---

## 🎯 Design Patterns

### 1. CQRS (Command Query Responsibility Segregation)

Used in several modules to separate read and write operations:

```typescript
// Command
class CreateYoutubeTranscriptionCommand {
  execute(dto: CreateDto): Promise<Transcription>;
}

// Query
class GetYoutubeTranscriptionByIdQuery {
  execute(id: string): Promise<TranscriptionDto>;
}
```

### 2. Repository Pattern

Abstracts data access:

```typescript
@Injectable()
class ArticlesRepository {
  async findById(id: string): Promise<Article | null>;
  async save(article: Article): Promise<Article>;
  async search(filters: SearchFilters): Promise<Article[]>;
}
```

### 3. Queue-Based Async Processing

Heavy operations are offloaded to background workers:

```typescript
// Controller
async createArticle(dto: CreateArticleDto) {
  const articleId = await this.scraperService.scrape(dto.url);
  const job = await this.queueService.addArticleProcessingJob(articleId);
  return { jobId: job.id, message: 'Queued' };
}

// Processor
@Processor('article-processing')
class ArticleProcessor {
  @Process('process-article')
  async process(job: Job<ProcessArticleJobData>) {
    // AI analysis, embeddings, etc.
  }
}
```

### 4. Dependency Injection

NestJS's DI container manages service lifecycles:

```typescript
@Module({
  imports: [S3Module, QueueModule],
  providers: [ArticlesService],
  controllers: [ArticlesController],
})
class ArticlesModule {}

@Injectable()
class ArticlesService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly queueService: QueueService,
  ) {}
}
```

---

## 🔒 Security Architecture

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Login   │────▶│ Validate │────▶│ Generate │
│          │     │ Endpoint │     │ Password │     │   JWT    │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                        │
                                                        ▼
                                               ┌──────────────┐
                                               │  Return      │
                                               │  {token, user}│
                                               └──────────────┘

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  API     │────▶│  JWT     │────▶│  Route   │
│  Request │     │ Gateway  │     │  Guard   │     │ Handler  │
│ + Token  │     │          │     │ Validate │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

### Security Layers

1. **JWT Authentication**: 24-hour token expiration
2. **Rate Limiting**: Redis-backed rate limiting on login
3. **Password Hashing**: bcrypt with 10 salt rounds
4. **Route Protection**: Global guard with `@Public()` decorator for exceptions
5. **Input Validation**: class-validator DTOs

---

## 📈 Scalability Considerations

### Horizontal Scaling

- **Stateless API servers**: Can run multiple instances behind a load balancer
- **Redis-backed queues**: BullMQ supports multiple workers
- **PostgreSQL**: Read replicas for query scaling
- **S3**: Unlimited storage scaling

### Performance Optimizations

1. **Queue Workers**: Parallel processing (configurable concurrency)
2. **Embedding Caching**: Articles with embeddings are reusable
3. **Presigned URLs**: Direct S3 uploads/downloads reduce server load
4. **Pagination**: All list endpoints use cursor/page-based pagination

---

## 🔄 Error Handling Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    Error Classification                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  RETRYABLE ERRORS                    FATAL ERRORS            │
│  ─────────────────                   ───────────             │
│  • Network timeouts                  • Invalid input         │
│  • Service unavailable               • Authentication failure│
│  • Rate limiting                     • Authorization failure │
│  • Temporary AI failures             • Data validation errors│
│                                                               │
│  HANDLING:                           HANDLING:               │
│  • BullMQ auto-retry                 • Immediate failure     │
│  • Exponential backoff               • Return error to client│
│  • Max 3 attempts                    • Log for monitoring    │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 📋 Configuration Hierarchy

```
┌──────────────────────────────────────────────────────────────┐
│                  Configuration Layers                         │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Environment Variables (.env)                             │
│     ┌────────────────────────────────────────────────────┐   │
│     │  DATABASE_URL, JWT_SECRET, API_KEYS               │   │
│     └────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          ▼                                    │
│  2. ConfigService (src/config/)                              │
│     ┌────────────────────────────────────────────────────┐   │
│     │  model.config.ts - AI provider settings           │   │
│     │  app.config.ts - Application parameters           │   │
│     │  prompt.config.ts - AI prompt templates           │   │
│     └────────────────────────────────────────────────────┘   │
│                          │                                    │
│                          ▼                                    │
│  3. Profile Configuration (src/profiles/)                    │
│     ┌────────────────────────────────────────────────────┐   │
│     │  Feed profiles with RSS sources and custom prompts│   │
│     └────────────────────────────────────────────────────┘   │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

*Last updated: March 2026*

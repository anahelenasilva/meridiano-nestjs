# Meridiano Developer Guide

A comprehensive guide for developers working on the Meridiano project.

---

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Working with Modules](#working-with-modules)
- [Database Operations](#database-operations)
- [Queue Workers](#queue-workers)
- [Testing](#testing)
- [CLI Commands](#cli-commands)
- [Ralph - Autonomous Agent](#ralph---autonomous-agent)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- Node.js 22+ (check `.nvmrc`)
- pnpm 10
- Docker & Docker Compose
- Git

### Initial Setup

```bash
# Clone the repository
git clone <repo_url> meridiano-nestjs
cd meridiano-nestjs

# Install dependencies
pnpm install

# Copy environment file
cp .env.sample .env

# Edit .env with your configuration
# Required: DATABASE_URL, JWT_SECRET, DEEPSEEK_API_KEY
# Optional: OPENAI_API_KEY, GROQ_API_KEY, etc.

# Start infrastructure services
pnpm run docker:up

# Build the project
pnpm run build

# Run database migrations
pnpm run migration:run

# Start development server
pnpm run start:dev
```

### Verify Setup

```bash
# Check API is running
curl http://localhost:3000/api/health

# Login (create a user first, then login)
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## Development Workflow

### Branch Strategy

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
# ...

# Run tests and linting
pnpm run test
pnpm run lint

# Commit changes
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/my-feature
```

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured in `eslint.config.mjs`
- **Prettier**: Configured in `.prettierrc`
- **EditorConfig**: Configured in `.editorconfig`

```bash
# Format code
pnpm run format

# Lint and fix
pnpm run lint
```

---

## Project Structure

### Domain vs Infrastructure

```
meridiano-nestjs/
├── src/              # Domain logic (business rules)
│   └── articles/     # Feature modules
├── libs/             # Infrastructure (cross-cutting)
│   └── s3/           # Reusable services
└── test/             # E2E tests
```

**Rule of thumb**:
- If it's business logic → `src/`
- If it's used by multiple modules → `libs/`

### Module Organization

Each module follows this structure:

```
articles/
├── articles.module.ts          # Module definition
├── articles.controller.ts      # API endpoints
├── articles.service.ts         # Business logic
├── articles.repository.ts      # Data access
├── entities/
│   └── article.entity.ts       # Database entity
├── dto/
│   └── create-article.dto.ts   # Input validation
├── queries/
│   └── list-articles.query.ts  # CQRS queries
├── commands/
│   └── create-article.command.ts # CQRS commands
└── processors/
    └── markdown.processor.ts   # Queue processors
```

---

## Working with Modules

### Creating a New Domain Module

```bash
# 1. Generate module using NestJS CLI
npx nest generate module features/my-feature

# 2. Create entity
# src/features/entities/my-feature.entity.ts

# 3. Create DTOs
# src/features/dto/create-feature.dto.ts

# 4. Implement service
# src/features/my-feature.service.ts

# 5. Implement controller
# src/features/my-feature.controller.ts

# 6. Add to AppModule imports
# src/app.module.ts
```

### Creating a New Library

```bash
# 1. Create library directory
mkdir -p libs/my-lib

# 2. Create module
# libs/my-lib/my-lib.module.ts

# 3. Create service
# libs/my-lib/my-lib.service.ts

# 4. Create barrel export
# libs/my-lib/index.ts

# 5. Update tsconfig.json paths (if needed)
# Already configured: "@libs/*": ["libs/*"]
```

### Example: Adding a New API Endpoint

```typescript
// src/articles/articles.controller.ts

@Controller('api/articles')
export class ArticlesController {
  @Get('search')
  async searchArticles(
    @Query('q') query: string,
    @Query('page') page: number = 1,
  ) {
    return this.articlesService.search(query, page);
  }
}

// src/articles/articles.service.ts

@Injectable()
export class ArticlesService {
  async search(query: string, page: number) {
    // Implementation
    return { articles: [], total: 0 };
  }
}
```

---

## Database Operations

### Creating an Entity

```typescript
// src/articles/entities/article.entity.ts

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'float', array: true, nullable: true })
  embedding: number[];

  @CreateDateColumn()
  created_at: Date;
}
```

### Creating a Migration

```bash
# Create empty migration
pnpm run migration:create src/database/migrations/AddArticleTags

# Or generate from entity changes
pnpm run migration:generate src/database/migrations/AutoGenerated
```

### Migration File Structure

```typescript
// src/database/migrations/XXXXXXXXXXXX-AddArticleTags.ts

export class AddArticleTagsXXXXXXXXXXXX implements MigrationInterface {
  name = 'AddArticleTagsXXXXXXXXXXXX';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      ADD COLUMN "tags" text[]
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "articles"
      DROP COLUMN "tags"
    `);
  }
}
```

### Running Migrations

```bash
# Run all pending migrations
pnpm run migration:run

# Revert last migration
pnpm run migration:revert

# Check migration status
pnpm run migration:run:direct -- --check
```

### Repository Pattern

```typescript
// src/articles/articles.repository.ts

@Injectable()
export class ArticlesRepository {
  constructor(
    @InjectRepository(Article)
    private readonly repository: Repository<Article>,
  ) {}

  async findById(id: string): Promise<Article | null> {
    return this.repository.findOne({ where: { id } });
  }

  async searchByTitle(query: string): Promise<Article[]> {
    return this.repository
      .createQueryBuilder('article')
      .where('article.title ILIKE :query', { query: `%${query}%` })
      .getMany();
  }

  async save(article: Partial<Article>): Promise<Article> {
    return this.repository.save(article);
  }
}
```

---

## Queue Workers

### Creating a Queue Processor

```typescript
// src/articles/processors/article.processor.ts

import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('article-processing')
export class ArticleProcessor {
  private readonly logger = new Logger(ArticleProcessor.name);

  @Process('process-article')
  async handleProcessArticle(job: Job<{ articleId: string }>) {
    this.logger.log(`Processing article ${job.data.articleId}`);

    try {
      // 1. Fetch article
      const article = await this.articlesService.getById(job.data.articleId);

      // 2. Generate summary
      const summary = await this.aiService.summarize(article.raw_content);

      // 3. Generate embeddings
      const embedding = await this.aiService.getEmbedding(summary);

      // 4. Update article
      await this.articlesService.update(job.data.articleId, {
        processed_content: summary,
        embedding,
      });

      this.logger.log(`Article ${job.data.articleId} processed successfully`);
    } catch (error) {
      this.logger.error(`Failed to process article: ${error.message}`);
      throw error; // BullMQ will handle retry
    }
  }
}
```

### Adding a Job to Queue

```typescript
// From a service
async queueArticleProcessing(articleId: string) {
  const job = await this.articleQueue.add('process-article', {
    articleId,
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });

  return { jobId: job.id };
}
```

### Monitoring Jobs

```bash
# Using Redis CLI
docker exec -it meridiano-redis redis-cli

# List BullMQ keys
keys bull:*

# Get job count
llen bull:article-processing:wait
llen bull:article-processing:completed
llen bull:article-processing:failed
```

---

## Testing

### Unit Tests

```typescript
// src/articles/articles.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesService } from './articles.service';
import { mock, MockProxy } from 'jest-mock-extended';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let repository: MockProxy<ArticlesRepository>;

  beforeEach(async () => {
    repository = mock<ArticlesRepository>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: ArticlesRepository, useValue: repository },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  describe('getById', () => {
    it('should return an article by ID', async () => {
      const article = { id: '123', title: 'Test' };
      repository.findById.mockResolvedValue(article as Article);

      const result = await service.getById('123');

      expect(result).toEqual(article);
      expect(repository.findById).toHaveBeenCalledWith('123');
    });

    it('should return null if not found', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await service.getById('999');

      expect(result).toBeNull();
    });
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm run test

# Watch mode
pnpm run test:watch

# Coverage report
pnpm run test:cov

# Specific test file
pnpm run test -- articles.service.spec.ts

# E2E tests
pnpm run test:e2e
```

### E2E Tests

```typescript
// test/articles.e2e-spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('ArticlesController (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login to get token
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    authToken = response.body.access_token;
  });

  it('/api/articles (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/articles')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.articles).toBeDefined();
      });
  });

  afterAll(async () => {
    await app.close();
  });
});
```

---

## CLI Commands

### Briefing Generation

```bash
# Generate briefing for specific feed
pnpm run briefing:tech
pnpm run briefing:brasil
pnpm run briefing:teclas

# Run specific pipeline stage
pnpm run briefing:scrape     # Only scrape feeds
pnpm run briefing:process    # Only process articles
pnpm run briefing:rate       # Only rate articles
pnpm run briefing:generate   # Only generate briefing
```

### YouTube Operations

```bash
# Extract transcripts from configured channels
pnpm run yt-transcript

# Process pending transcriptions
pnpm run process-transcriptions

# List all transcriptions
pnpm run list-transcriptions
```

### Database Operations

```bash
# Create new migration
pnpm run migration:create src/database/migrations/MyMigration

# Generate migration from entities
pnpm run migration:generate src/database/migrations/AutoMigration

# Run migrations
pnpm run migration:run

# Revert last migration
pnpm run migration:revert
```

### Docker Operations

```bash
# Start services
pnpm run docker:up

# View logs
pnpm run docker:logs

# Stop services
pnpm run docker:down

# Rebuild with no cache
docker-compose build --no-cache
```

---

## Ralph - Autonomous Agent

Ralph is an autonomous coding agent that implements user stories from a PRD (Product Requirements Document).

### How It Works

1. **Create PRD**: Write a detailed requirements document
2. **Convert to JSON**: Convert PRD to Ralph's format
3. **Run Ralph**: Execute stories iteratively

### Workflow

```bash
# 1. Generate PRD (using skills)
# /generate-prd create a PRD for [feature]

# 2. Convert to Ralph format
# /ralph convert tasks/prd-feature.md to prd.json

# 3. Run Ralph
pnpm run ralph        # Execute one story
pnpm run ralph:single # Execute single iteration
```

### Ralph Files

- `scripts/ralph/prd.json` - User stories in JSON format
- `scripts/ralph/prompt.md` - Instructions for the agent
- `scripts/ralph/progress.txt` - Current progress log

See [Ralph README](../scripts/ralph/README.md) for detailed documentation.

---

## Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs meridiano-postgres-local

# Verify connection string
psql $DATABASE_URL -c "\dt"
```

#### Redis Connection Failed

```bash
# Check if Redis is running
docker ps | grep redis

# Test connection
docker exec -it meridiano-redis redis-cli ping
```

#### Migration Errors

```bash
# Reset database (WARNING: DESTROYS DATA)
docker-compose down -v
pnpm run docker:up

# Re-run migrations
pnpm run migration:run
```

#### Queue Jobs Not Processing

```bash
# Check Redis for stuck jobs
docker exec -it meridiano-redis redis-cli
keys bull:*

# Restart workers (stop and start dev server)
```

#### TypeScript Compilation Errors

```bash
# Clean and rebuild
rm -rf dist/
pnpm run build

# Check for type errors
npx tsc --noEmit
```

### Debug Mode

```bash
# Start with debug enabled
pnpm run start:debug

# Or use Node inspector
node --inspect-brk dist/src/main
```

### Logs

```bash
# Application logs (in another terminal)
pnpm run start:dev 2>&1 | tee app.log

# Docker logs
docker-compose logs -f

# Filter specific service
docker-compose logs -f postgres
```

---

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/meridian` |
| `JWT_SECRET` | Secret for JWT signing | `your-secret-key-min-32-chars` |
| `DEEPSEEK_API_KEY` | DeepSeek AI API key | `sk-...` |
| `EMBEDDING_API_KEY` | Together.xyz API key | `...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `GROQ_API_KEY` | Groq API key | - |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `S3_ARTICLES_BUCKET_NAME` | S3 bucket for articles | - |
| `MAILGUN_API_KEY` | Mailgun API key | - |
| `MAILGUN_DOMAIN` | Mailgun domain | - |

---

## Best Practices

### 1. Use CQRS for Complex Operations

```typescript
// commands/create-article.command.ts
@Injectable()
export class CreateArticleCommand {
  async execute(dto: CreateArticleDto): Promise<Article> {
    // Complex creation logic
  }
}

// queries/get-article-by-id.query.ts
@Injectable()
export class GetArticleByIdQuery {
  async execute(id: string): Promise<ArticleDto> {
    // Optimized read logic
  }
}
```

### 2. Implement Proper Error Handling

```typescript
@Injectable()
export class ArticlesService {
  async getById(id: string): Promise<Article> {
    const article = await this.repository.findById(id);

    if (!article) {
      throw new NotFoundException(`Article with ID ${id} not found`);
    }

    return article;
  }
}
```

### 3. Use DTOs for API Contracts

```typescript
// dto/create-article.dto.ts
export class CreateArticleDto {
  @IsUrl()
  url: string;

  @IsString()
  @IsOptional()
  feedProfile?: string;
}

// dto/article-response.dto.ts
export class ArticleResponseDto {
  id: string;
  title: string;
  url: string;

  constructor(article: Article) {
    this.id = article.id;
    this.title = article.title;
    this.url = article.url;
  }
}
```

### 4. Write Tests

- Unit tests for services and repositories
- E2E tests for critical endpoints
- Mock external dependencies

### 5. Document Public APIs

```typescript
/**
 * Creates a new article from a URL.
 * Scrapes the content and queues for processing.
 *
 * @param dto - Article creation data
 * @returns Job information for tracking
 * @throws BadRequestException if URL is invalid
 */
@Post()
async create(@Body() dto: CreateArticleDto): Promise<JobInfo> {
  // Implementation
}
```

---

## Resources

- [Project Documentation Index](./PROJECT_DOCUMENTATION_INDEX.md)
- [API Reference](./API_REFERENCE.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Libraries Guide](./LIBRARIES.md)
- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [BullMQ Documentation](https://docs.bullmq.io)

---

*Last updated: March 2026*

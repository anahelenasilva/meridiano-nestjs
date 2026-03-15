# Logging Standardization Implementation Plan

## Context

The codebase has inconsistent logging patterns that hinder observability:
- **Pattern 1**: NestJS `Logger` with structured objects (24 instances in `libs/`)
- **Pattern 2**: Native `console.*` (50+ instances across codebase)
- **Pattern 3**: Bracket-prefixed `console.*` (infrastructure libs)
- **No correlation IDs** for request tracing
- **No JSON output** for observability tooling

The user needs:
1. Structured JSON logs
2. Correlation IDs for request tracing across async operations
3. Backend-agnostic solution (observability tool TBD)

## Recommended Solution: Pino + nestjs-pino

### Why Pino
- Native JSON output
- Highest performance Node.js logger
- Child loggers for request-scoped context (correlation IDs)
- Works with any observability backend
- First-class NestJS integration via `nestjs-pino`

---

## Implementation Steps

### Phase 1: Foundation (Core Infrastructure)

#### Step 1.1: Install Dependencies
```bash
pnpm add pino nestjs-pino pino-http
pnpm add -D @types/pino
```

#### Step 1.2: Create LoggingModule
**File**: `libs/logging/logging.module.ts`

Create a global module that:
- Configures Pino with JSON formatter
- Registers `LoggerModule` from `nestjs-pino`
- Provides a `PinoLogger` injection token
- Sets up log level from environment variable (`LOG_LEVEL`, default: `info`)

#### Step 1.3: Create Correlation ID Middleware
**File**: `libs/logging/middleware/correlation-id.middleware.ts`

```typescript
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract or generate correlation ID
    const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || uuidv4();

    // Store in AsyncLocalStorage for access in services
    correlationIdStore.set(correlationId);

    // Add to response headers for client tracing
    res.setHeader('x-correlation-id', correlationId);

    next();
  }
}
```

#### Step 1.4: Create Correlation ID Storage
**File**: `libs/logging/correlation-id.store.ts`

Use Node.js `AsyncLocalStorage` to propagate correlation IDs across async boundaries without explicit parameter passing.

#### Step 1.5: Create Custom PinoLogger Wrapper
**File**: `libs/logging/services/app-logger.service.ts`

Wraps `PinoLogger` to:
- Automatically inject correlation ID from AsyncLocalStorage
- Provide consistent interface: `logger.info({ articleId }, 'message')`
- Handle both object and string arguments gracefully

#### Step 1.6: Update main.ts
**File**: `src/main.ts`

- Replace `NestFactory.create(AppModule)` with buffer logs option
- Apply Pino logger as application logger
- Remove manual `console.log` startup messages

---

### Phase 2: Queue Integration (Correlation ID Propagation)

#### Step 2.1: Update Job Data Interfaces
**Files**:
- `libs/queue/interfaces/article-job.interface.ts`
- `libs/queue/interfaces/audio-job.interface.ts`
- `libs/queue/interfaces/youtube-transcription-job.interface.ts`

Add optional `correlationId?: string` to each job data interface.

#### Step 2.2: Update QueueService
**File**: `libs/queue/queue.service.ts`

When adding jobs, inject correlation ID:
```typescript
const correlationId = correlationIdStore.get();
const jobData = {
  ...data,
  correlationId,
};
```

#### Step 2.3: Create Queue Logger Helper
**File**: `libs/logging/helpers/queue-logger.helper.ts`

Creates a child logger for queue processors with correlation ID from job data:
```typescript
export function createJobLogger(logger: PinoLogger, job: Job) {
  return logger.child({ correlationId: job.data.correlationId, jobId: job.id });
}
```

---

### Phase 3: Service Migration (Incremental)

#### Priority Order (High to Low Impact)

**Tier 1: Queue Processors** (Most critical for observability)
- `libs/queue/processors/audio-generation.processor.ts` ✅ Already structured (minor update)
- `libs/queue/processors/article.processor.ts` ❌ Uses `console.*`
- `src/articles/processors/markdown-article.processor.ts` ❌ Uses `console.*`
- `src/youtube-transcriptions/processors/youtube-transcription.processor.ts` ❌ Uses `console.*`

**Tier 2: Core Services**
- `libs/queue/queue.service.ts` ⚠️ Mixed (uses both)
- `src/processor/processor.service.ts` ⚠️ Mixed
- `src/scraper/scraper.service.ts` ❌ Uses `console.*`
- `src/briefing/briefing.service.ts` ❌ Uses `console.*`
- `src/ai/ai.service.ts` ❌ Uses `console.*`

**Tier 3: Infrastructure Services**
- `libs/redis/redis.service.ts` ❌ Uses bracket-prefixed `console.*`
- `libs/database/postgres-database.service.ts` ❌ Uses bracket-prefixed `console.*`
- `libs/s3/s3.service.ts` ❌ Uses `console.*`

**Tier 4: Controllers and Queries**
- `src/articles/external-articles.controller.ts` ✅ Already uses `Logger`
- `src/articles/queries/get-article-by-id.query.ts` ✅ Already uses `Logger`

---

### Phase 4: Scripts (Keep Human-Readable)

Scripts like `src/scripts/runBriefing.ts` and `scripts/run-migrations.ts` should:
- **Keep using `console.*`** - these are CLI tools meant for human consumption
- Optionally create a separate `CliLogger` with `pino-pretty` for development

---

## Migration Pattern

### Before
```typescript
// Service with console.*
export class ScraperService {
  async scrapeArticles() {
    console.log('Fetching article content...');
    console.error(`Error processing feed ${feedUrl}:`, error);
  }
}

// Processor with mixed
export class ArticleProcessor implements OnModuleInit {
  onModuleInit() {
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });
  }
}
```

### After
```typescript
// Service with PinoLogger
export class ScraperService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ScraperService.name);
  }

  async scrapeArticles() {
    this.logger.info('Fetching article content');
    this.logger.error({ feedUrl, error: error.message }, 'Error processing feed');
  }
}

// Processor with structured logging
export class ArticleProcessor implements OnModuleInit {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ArticleProcessor.name);
  }

  onModuleInit() {
    this.worker.on('completed', (job) => {
      this.logger.info({ jobId: job.id }, 'Job completed');
    });
  }
}
```

---

## File Structure

```
libs/logging/
├── logging.module.ts           # Global module
├── correlation-id.store.ts     # AsyncLocalStorage for correlation IDs
├── middleware/
│   └── correlation-id.middleware.ts
├── services/
│   └── app-logger.service.ts   # PinoLogger wrapper with auto correlation ID
├── helpers/
│   └── queue-logger.helper.ts  # Logger factory for queue jobs
├── interfaces/
│   └── logger.interface.ts     # Type definitions
└── index.ts                    # Barrel export
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Log level (trace, debug, info, warn, error, fatal) |
| `LOG_PRETTY` | `false` | Enable pino-pretty for development (set to `true` locally) |
| `LOG_REDACT_PATHS` | `["password", "token", "authorization"]` | Paths to redact from logs |

---

## Verification

### Unit Tests
- Test correlation ID propagation through middleware
- Test logger outputs correct JSON structure
- Test queue logger helper extracts correlation ID from job

### Integration Tests
- Verify HTTP requests include `x-correlation-id` header
- Verify correlation ID appears in all logs within request scope
- Verify queue jobs propagate correlation ID from producer to consumer

### Manual Verification
1. Start server: `pnpm run start:dev`
2. Make API request, verify JSON log output:
   ```json
   {"level":30,"time":1709529600000,"correlationId":"abc-123","context":"ArticlesController","msg":"Processing request"}
   ```
3. Check queue processor logs include correlation ID
4. Verify `pino-pretty` works when `LOG_PRETTY=true`

---

## Rollout Strategy

1. **Phase 1** (Week 1): Infrastructure setup - LoggingModule, middleware, tests
2. **Phase 2** (Week 1-2): Queue integration and migration
3. **Phase 3** (Week 2-3): Service migration (Tier 1 → Tier 2 → Tier 3)
4. **Phase 4** (Ongoing): New services use new pattern by default

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing log consumers | Phase rollout allows gradual migration |
| Performance overhead | Pino is the fastest Node.js logger; benchmark shows < 1ms per 10k logs |
| Lost correlation in complex flows | AsyncLocalStorage handles most async patterns; document edge cases |
| Circular dependency in LoggingModule | Make module global with `isGlobal: true`, avoid importing services that use logger |
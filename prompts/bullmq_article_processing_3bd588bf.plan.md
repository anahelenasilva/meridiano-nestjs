---
name: BullMQ article processing
overview: Implement BullMQ to asynchronously process manually added articles (summarize, rate, categorize) instead of processing them synchronously in the POST endpoint.
todos:
  - id: install-deps
    content: Install bullmq and ioredis packages
    status: pending
  - id: create-queue-constants
    content: Create queue constants and job data interfaces
    status: pending
  - id: create-redis-service
    content: Create Redis connection service
    status: pending
  - id: create-queue-module
    content: Create QueueModule with Queue provider
    status: pending
  - id: update-articles-service
    content: Add methods to fetch single articles by ID for processing
    status: pending
  - id: update-processor-service
    content: Modify ProcessorService methods to support single article processing
    status: pending
  - id: create-article-processor
    content: Create article processor/consumer to handle queued jobs
    status: pending
  - id: update-articles-controller
    content: Update ArticlesController to enqueue jobs instead of processing synchronously
    status: pending
  - id: add-redis-config
    content: Add Redis configuration to ConfigService and .env.sample
    status: pending
  - id: update-app-module
    content: Import QueueModule in AppModule
    status: pending
---

# BullMQ Article Processing Implementation

## Overview

Add BullMQ job queue to handle asynchronous processing of manually added articles. When an article is added via POST /api/articles, it will be queued for processing (summarize, rate, categorize) rather than processed synchronously.

## Implementation Steps

### 1. Install BullMQ Dependencies

Install the required packages:
- `bullmq` - The job queue library
- `ioredis` - Redis client (BullMQ dependency)

```bash
pnpm add bullmq ioredis
pnpm add -D @types/ioredis
```

### 2. Create Queue Module

Create a new `src/queue` directory with the following structure:

**File: `src/queue/queue.module.ts`**
- Define a NestJS module that exports BullMQ Queue instances
- Import required modules: `ProcessorModule`, `ArticlesModule`, `AiModule`, `ConfigModule`
- Create and provide a Queue instance for article processing

**File: `src/queue/queue.constants.ts`**
- Define queue names as constants (e.g., `ARTICLE_PROCESSING_QUEUE`)
- Define job names (e.g., `PROCESS_ARTICLE_JOB`)

**File: `src/queue/interfaces/article-job.interface.ts`**
- Define the job data structure:
```typescript
interface ProcessArticleJobData {
  articleId: number;
  feedProfile: FeedProfile;
}
```

### 3. Create Article Processor (Consumer)

**File: `src/queue/processors/article.processor.ts`**
- Create a processor class that extends BullMQ's Worker
- Implement a method to process article jobs that:
  1. Fetches the article by ID using `ArticlesService.getArticleById()`
  2. Calls `ProcessorService.processArticles()` with a filter to process only this article ID
  3. Calls `ProcessorService.rateArticles()` with a filter for this article ID  
  4. Calls `ProcessorService.categorizeArticles()` with a filter for this article ID
  5. Returns success/failure status

**Note**: The current `ProcessorService` methods process articles in batch mode. We'll need to modify them to optionally accept a single article ID to process.

### 4. Modify ProcessorService for Single Article Processing

**File: `src/processor/processor.service.ts`**

Modify these methods to accept an optional `articleId` parameter:
- `processArticles(feedProfile, limit?, articleId?)`
- `rateArticles(feedProfile, limit?, articleId?)`
- `categorizeArticles(feedProfile, limit?, articleId?)`

When `articleId` is provided, only process that specific article instead of fetching unprocessed/unrated/uncategorized articles.

### 5. Add ArticlesService Method

**File: `src/articles/articles.service.ts`**

Add a method to fetch a single unprocessed article by ID:
```typescript
async getUnprocessedArticleById(articleId: number): Promise<DBArticle | null>
```

Similar methods for:
- `getUnratedArticleById(articleId: number)`
- `getUncategorizedArticleById(articleId: number)`

### 6. Update ArticlesController

**File: `src/articles/articles.controller.ts`**

Modify the `createArticle` method (line 30-61) to:
1. Keep the existing scraping logic via `scraperService.scrapeSingleArticle()`
2. After successful scraping, add a job to the queue instead of processing synchronously
3. Return immediately with:
   - Article ID
   - Job ID for tracking
   - Success message

```typescript
// After article is scraped
const job = await this.articleQueue.add(PROCESS_ARTICLE_JOB, {
  articleId,
  feedProfile,
});

return {
  success: true,
  articleId,
  jobId: job.id,
  message: 'Article scraped and queued for processing',
};
```

### 7. Add Queue Configuration

**File: `.env` (update .env.sample)**
Add Redis configuration:
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

**File: `src/config/config.service.ts`**
Add methods to read Redis configuration from environment variables.

### 8. Update App Module

**File: `src/app.module.ts`**
Import the new `QueueModule` to make it available application-wide.

### 9. Optional: Add Job Status Endpoint

**File: `src/articles/articles.controller.ts`**

Add a GET endpoint to check processing status:
```typescript
@Get('jobs/:jobId')
async getJobStatus(@Param('jobId') jobId: string)
```

This will query the BullMQ job status and return current state (waiting, active, completed, failed).

## Key Implementation Details

### Redis Connection
BullMQ requires Redis. Create a shared Redis connection service in `src/queue/redis.service.ts` that:
- Connects to Redis using environment variables
- Exports an IORedis client instance for use by Queue and Worker

### Error Handling
The article processor should:
- Catch errors during processing steps
- Log errors appropriately
- Mark jobs as failed with error details
- Support retries (configure in queue options)

### Module Dependencies
- `QueueModule` needs: `ArticlesModule`, `ProcessorModule`, `AiModule`, `ConfigModule`
- `ArticlesModule` needs: `QueueModule` (for enqueueing jobs)

Avoid circular dependencies by carefully structuring imports.

## Testing Approach

After implementation:
1. Start Redis locally (`docker run -d -p 6379:6379 redis`)
2. POST a new article URL to `/api/articles`
3. Verify the response includes `jobId`
4. Check article processing happens asynchronously
5. Verify article gets summarized, rated, and categorized

## Files to Create
- `src/queue/queue.module.ts`
- `src/queue/queue.constants.ts`
- `src/queue/redis.service.ts`
- `src/queue/interfaces/article-job.interface.ts`
- `src/queue/processors/article.processor.ts`

## Files to Modify
- `src/articles/articles.controller.ts`
- `src/articles/articles.service.ts`
- `src/articles/articles.module.ts`
- `src/processor/processor.service.ts`
- `src/config/config.service.ts`
- `src/app.module.ts`
- `.env.sample`
- `package.json` (via pnpm install)
---
title: 'Vector-Based Semantic Search for Articles'
slug: 'vector-semantic-search-articles'
created: '2026-03-23'
updated: '2026-03-23'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['NestJS 11', 'TypeScript', 'PostgreSQL', 'pgvector', 'BullMQ', 'Jest']
files_to_modify: ['src/database/migrations/', 'src/articles/articles.service.ts', 'src/articles/queries/list-articles.query.ts', 'src/articles/article.entity.ts', 'src/articles/articles.module.ts', 'src/config/config.service.ts', 'libs/queue/constants/queue.constants.ts', 'libs/queue/interfaces/', 'libs/queue/queue.service.ts', 'libs/queue/queue.module.ts', 'libs/queue/processors/embedding-generation.processor.ts', 'test/fixtures/embeddings/']
code_patterns: ['CQRS (Query/Command classes)', 'Raw SQL via DatabaseService', 'Callback-based DB operations', 'BullMQ queues with constants/interfaces/processors']
test_patterns: ['Jest with jest-mock-extended', 'Mock dependencies with mock<T>()', 'Co-located *.spec.ts files']
---

# Tech-Spec: Vector-Based Semantic Search for Articles

**Created:** 2026-03-23
**Updated:** 2026-03-23 (Post-elicitation clarifications)

## Overview

### Problem Statement

Users can only search articles using keyword matching (`LIKE` queries), which fails to find semantically related content when keywords don't match exactly. "AI agents" query won't find an article about "autonomous software assistants" even though they're the same concept.

### Solution

Implement pgvector extension in PostgreSQL, store article embeddings, and create a hybrid search API that combines keyword matching with semantic similarity for more relevant results.

### Scope

**In Scope:**
- Enable pgvector extension in PostgreSQL
- Add new `embedding_vector vector(1024)` column to articles table (keep existing `embedding` TEXT column until backfill verified)
- Migrate existing JSON embeddings from `embedding` TEXT column to `embedding_vector` vector column
- Generate embeddings from `title + processed_content` using E5-large model (1024 dimensions)
- Extend existing `GET /api/articles` endpoint with `mode` query param (keyword/semantic/hybrid), default: keyword
- Hybrid search using reciprocal rank fusion to combine keyword + vector similarity
- On-demand backfill for missing embeddings (graceful fallback to keyword-only when embedding absent)
- Background job for embedding generation (queue-based with rate limiting)

**Out of Scope:**
- Briefings embeddings
- YouTube transcriptions embeddings (separate spec)
- Vector dimension optimization or model fine-tuning
- Real-time embedding updates on article edits (embeddings become stale when title/content changes — manual re-embedding required via admin action or future feature)

## Context for Development

### Codebase Patterns

- NestJS 11 with TypeORM for database access
- PostgreSQL via `pg` driver
- AiService already has `getEmbedding()` using Together.xyz API with E5 models
- Current search is keyword-based using `LIKE` on title, raw_content, processed_content
- ArticlesService handles search in `listArticles()` method
- Migrations use TypeORM migration files in `src/database/migrations/`

### Files to Reference

| File                                                     | Purpose                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| `src/articles/articles.service.ts`                       | Current keyword search implementation (LIKE queries), DB operations |
| `src/articles/queries/list-articles.query.ts`            | CQRS Query class for paginated article listing                      |
| `src/articles/articles.controller.ts`                    | REST controller, endpoint patterns                                  |
| `src/articles/article.entity.ts`                         | Article interface with embedding field                              |
| `src/ai/ai.service.ts`                                   | Embedding generation (getEmbedding, getBatchEmbeddings)             |
| `libs/queue/queue.service.ts`                            | BullMQ job enqueue patterns                                         |
| `libs/queue/constants/queue.constants.ts`                | Queue name constants pattern                                        |
| `src/database/migrations/1735027200000-InitialSchema.ts` | Migration structure reference                                       |
| `libs/database/database.service.ts`                      | Raw SQL execution via getDbConnection()                             |

### Technical Decisions

**Embedding Model & Dimensions:**
- Use existing E5-large model via Together.xyz API (1024 dimensions)
- Dimension is fixed — changing requires re-embedding all content
- Store in `embedding_vector vector(1024)` column (new column, not migration of existing TEXT)

**E5 Prefix Handling:**
- `AiService.getEmbedding()` defaults to `passage:` prefix for documents
- For search queries, prepend `query:` prefix before calling `getEmbedding()`
- Example: `getEmbedding('query: machine learning algorithms')` for semantic search
- The service detects existing prefixes and won't double-prefix

**Hybrid Search Algorithm:**
- Reciprocal Rank Fusion (RRF) to combine keyword and semantic scores
- Both result sets are ranked by position (1, 2, 3...), then RRF applied
- RRF formula: `score = 1 / (k + rank_position)` where k=60 (configurable)
- Final ranking: sum of keyword RRF score + semantic RRF score
- When embedding missing: fallback to keyword-only, log gap, queue backfill job
- When ALL embeddings missing (fresh DB): return keyword results with warning in response
- Default mode: `keyword` (avoids embedding API call on every search)

**Database Migration Strategy:**
- Add new `embedding_vector` column alongside existing `embedding` TEXT
- One-time migration: parse existing JSON embeddings and populate `embedding_vector`
- Keep both during transition; drop TEXT column after backfill verified
- Create pgvector extension in same migration

**On-Demand Backfill:**
- Check for missing embeddings at search time
- Queue background job (BullMQ) to generate embedding
- Don't block user search — return keyword results, fill gap asynchronously
- Log missing embeddings for monitoring
- Rate limiting on queue processor to respect API limits

**Filter Application:**
- All search modes (keyword, semantic, hybrid) apply the same filters
- Filters: feedProfile, startDate, endDate, category
- Semantic search SQL must include WHERE clauses for filters

### Testing Strategy

**Level 1: Unit Tests (Pure Logic)**
- Test embedding text preparation (`title + processed_content` concatenation)
- Test RRF score calculation with known rank positions
- Test hybrid mode fallback when embedding missing
- Test embedding vector validation (only valid floats)
- No external API calls, deterministic

**Level 2: Integration Tests (With Fixture Embeddings)**
- Seed test DB with 5-10 known articles from fixtures
- Pre-computed embeddings stored in `test/fixtures/embeddings/`
- Query with known semantic matches (e.g., "machine learning" → finds "neural networks" article)
- Assert ranking order matches expected similarity
- Test hybrid vs semantic vs keyword mode differences

**Test Data:**
```
Article 1: "Introduction to Neural Networks" (ML topic)
Article 2: "Deep Learning Best Practices" (ML topic)
Article 3: "React Hooks Tutorial" (Frontend topic)
Article 4: "TypeScript Generics Explained" (Frontend topic)
Article 5: "Cooking Italian Pasta" (Unrelated control)

Query: "machine learning algorithms"
Expected: Articles 1, 2 ranked highest (semantic match)
```

**Key Test Cases:**
- Semantic query returns semantically similar results, not just keyword matches
- Keyword-only mode works without embeddings
- Hybrid mode blends both signals correctly via RRF
- Missing embedding falls back gracefully (logged, not error)
- Pagination works with vector search
- Filters are applied correctly in all modes

## Implementation Plan

### Tasks

**Phase 1: Database Schema**

- [ ] Task 1: Create migration for pgvector extension and embedding_vector column
  - File: `src/database/migrations/{timestamp}-AddVectorExtensionAndEmbeddingColumn.ts`
  - Action: Run `pnpm run migration:create src/database/migrations/AddVectorExtensionAndEmbeddingColumn` to generate with correct timestamp, then implement:
    1. Creates pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
    2. Adds `embedding_vector vector(1024)` column to articles table
    3. Creates IVFFlat index for vector similarity with appropriate lists parameter. For initial deployment with sparse vectors, use `lists = 1` (can be recreated later with more lists as data grows):
       ```sql
       CREATE INDEX idx_articles_embedding_vector ON articles USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 1);
       ```
  - Notes: IVFFlat with `lists = 1` behaves similarly to brute-force search, appropriate for MVP with sparse data. Re-create index with `lists = rows/1000` when you have 1000+ vectors. Run with `pnpm run migration:run`

- [ ] Task 1.1: Create migration to migrate existing embeddings
  - File: `src/database/migrations/{timestamp}-MigrateExistingEmbeddings.ts`
  - Action: Create a separate migration (runs after Task 1) that:
    1. Parses existing JSON embeddings from `embedding` TEXT column
    2. Validates each embedding is a valid array of 1024 floats
    3. Updates `embedding_vector` column with parsed values
    4. Logs count of migrated embeddings
  - Implementation:
    ```sql
    UPDATE articles
    SET embedding_vector = embedding::jsonb::vector
    WHERE embedding IS NOT NULL
      AND embedding != ''
      AND jsonb_array_length(embedding::jsonb) = 1024;
    ```
  - Notes: Run after verifying Task 1 migration succeeded. Check logs for migration count.

- [ ] Task 2: Update DBArticle interface
  - File: `src/articles/article.entity.ts`
  - Action: Add `embedding_vector?: number[] | null` field to DBArticle interface
  - Notes: Keep existing `embedding?: string | null` field for backward compatibility during migration

**Phase 2: Queue Infrastructure for On-Demand Backfill**

- [ ] Task 3: Add embedding queue constants
  - File: `libs/queue/constants/queue.constants.ts`
  - Action: Add:
    ```typescript
    export const EMBEDDING_GENERATION_QUEUE = 'embedding-generation';
    export const GENERATE_EMBEDDING_JOB = 'generate-embedding';
    ```

- [ ] Task 4: Create embedding job interface
  - File: `libs/queue/interfaces/embedding-job.interface.ts` (new file)
  - Action: Create interface:
    ```typescript
    export interface GenerateEmbeddingJobData {
      articleId: string;
      title: string;
      processedContent: string;
    }
    ```

- [ ] Task 5: Register embedding queue in QueueModule
  - File: `libs/queue/queue.module.ts`
  - Action: Register BullMQ queue for `EMBEDDING_GENERATION_QUEUE` following existing pattern. Import and add `AiModule` to imports so the processor can inject `AiService`.

- [ ] Task 5.1: Configure queue rate limiting
  - File: `libs/queue/queue.module.ts`
  - Action: Add rate limiter configuration to the embedding queue registration:
    ```typescript
    BullModule.registerQueue({
      name: EMBEDDING_GENERATION_QUEUE,
      limiter: {
        max: 10,        // max 10 jobs per duration
        duration: 60000 // per 60 seconds (Together.xyz rate limit)
      }
    })
    ```
  - Notes: Adjust `max` and `duration` based on Together.xyz API tier. This prevents overwhelming the embedding API during backfill operations.

- [ ] Task 6: Add embedding job enqueue method to QueueService
  - File: `libs/queue/queue.service.ts`
  - Action: Add `addEmbeddingGenerationJob(articleId: string, title: string, processedContent: string)` method
  - Notes: Follow pattern of `addArticleProcessingJob`

- [ ] Task 7: Create embedding generation processor
  - File: `libs/queue/processors/embedding-generation.processor.ts` (new file)
  - Action: Create BullMQ processor that:
    1. Concatenates `title + ' ' + processedContent`
    2. Calls `AiService.getEmbedding()` with `passage:` prefix (handled by AiService)
    3. Validates embedding is valid array of floats
    4. Updates article's `embedding_vector` column in database
    5. Handles DB write failures with retry
  - Notes: Inject AiService, DatabaseService. Handle null/empty content gracefully. Configure retry with exponential backoff:
    ```typescript
    @Process(GENERATE_EMBEDDING_JOB, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
    ```

**Phase 3: Vector Search Implementation**

- [ ] Task 8: Add updateArticleEmbedding method to ArticlesService
  - File: `src/articles/articles.service.ts`
  - Action: Add method to update `embedding_vector` column:
    ```typescript
    async updateArticleEmbedding(articleId: string, embedding: number[]): Promise<void>
    ```
  - Notes: Follow existing callback pattern. Validate embedding before update.

- [ ] Task 9: Add embedding vector validation helper
  - File: `src/articles/helpers/validate-embedding.ts` (new file)
  - Action: Create validation function:
    ```typescript
    export function isValidEmbeddingVector(embedding: unknown): embedding is number[] {
      if (!Array.isArray(embedding)) return false;
      if (embedding.length !== 1024) return false;
      return embedding.every(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    }
    ```
  - Notes: Use this before any database write or SQL interpolation with embeddings.

- [ ] Task 10: Add semantic search method to ArticlesService
  - File: `src/articles/articles.service.ts`
  - Action: Add `searchArticlesSemantic(queryEmbedding: number[], options: PaginatedArticleInput): Promise<{ articles: DBArticle[], ranks: Map<string, number> }>` method
  - Implementation:
    1. Validate `queryEmbedding` using `isValidEmbeddingVector()`
    2. Build filter WHERE clauses from `options` (feedProfile, startDate, endDate, category)
    3. Format the query embedding as a vector string literal
    4. Execute raw SQL with pgvector cosine similarity
    ```typescript
    // Build filters first
    const filterClauses: string[] = ['embedding_vector IS NOT NULL'];
    const params: (string | number)[] = [];

    if (options.feedProfile) {
      filterClauses.push('feed_profile = ?');
      params.push(options.feedProfile);
    }
    // ... other filters

    // Validate and format embedding safely
    if (!isValidEmbeddingVector(queryEmbedding)) {
      throw new BadRequestException('Invalid embedding vector');
    }
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    const query = `
      SELECT *, 1 - (embedding_vector <=> '${vectorLiteral}'::vector) as similarity
      FROM articles
      WHERE ${filterClauses.join(' AND ')}
      ORDER BY embedding_vector <=> '${vectorLiteral}'::vector
      LIMIT ? OFFSET ?
    `;
    ```
  - Notes: The `<=>` operator returns cosine distance (0 = identical, 2 = opposite). Returns `ranks` Map for RRF fusion (article ID → rank position). Validation prevents SQL injection.

- [ ] Task 11: Add keyword search result method to ArticlesService
  - File: `src/articles/articles.service.ts`
  - Action: Add `searchArticlesKeywordWithRank(searchTerm: string, options: PaginatedArticleInput): Promise<{ articles: DBArticle[], ranks: Map<string, number> }>` method
  - Notes: Returns articles with their rank positions for RRF fusion. Use Map for O(1) lookups during fusion.

- [ ] Task 12: Add count method for semantic search with filters
  - File: `src/articles/articles.service.ts`
  - Action: Add `countTotalArticlesSemantic(options: PaginatedArticleInput): Promise<number>` method
  - Notes: Count articles matching filters AND having non-null `embedding_vector`. Used for pagination metadata in semantic-only mode.

- [ ] Task 13: Add count method for hybrid search
  - File: `src/articles/articles.service.ts`
  - Action: Add `countTotalArticlesHybrid(searchTerm: string, options: PaginatedArticleInput): Promise<number>` method
  - Implementation: Returns count of articles matching keyword filters OR having embeddings with filter match
  - Notes: This is an approximation for pagination. Hybrid mode pagination is inherently approximate due to result merging.

**Phase 4: Hybrid Search & API**

- [ ] Task 14: Update PaginatedArticleInput interface
  - File: `src/articles/article.entity.ts`
  - Action: Add `mode?: 'keyword' | 'semantic' | 'hybrid'` field (default: 'keyword')

- [ ] Task 15: Create RRF fusion helper
  - File: `src/articles/helpers/reciprocal-rank-fusion.ts` (new file)
  - Action: Create RRF implementation:
    ```typescript
    export interface RRFResult {
      articleId: string;
      article: DBArticle;
      rrfScore: number;
    }

    export function reciprocalRankFusion(
      keywordResults: { articles: DBArticle[]; ranks: Map<string, number> },
      semanticResults: { articles: DBArticle[]; ranks: Map<string, number> },
      k: number = 60
    ): RRFResult[] {
      const scoreMap = new Map<string, { article: DBArticle; score: number }>();

      // Process keyword results
      for (const article of keywordResults.articles) {
        const rank = keywordResults.ranks.get(article.id) ?? Infinity;
        const score = 1 / (k + rank);
        scoreMap.set(article.id, { article, score });
      }

      // Process semantic results and sum scores
      for (const article of semanticResults.articles) {
        const rank = semanticResults.ranks.get(article.id) ?? Infinity;
        const score = 1 / (k + rank);
        const existing = scoreMap.get(article.id);
        if (existing) {
          existing.score += score;
        } else {
          scoreMap.set(article.id, { article, score });
        }
      }

      // Sort by combined score descending
      return Array.from(scoreMap.values())
        .sort((a, b) => b.score - a.score)
        .map(({ article, score }) => ({ articleId: article.id, article, rrfScore: score }));
    }
    ```
  - Notes: Both keyword and semantic results contribute rank positions (1, 2, 3...), not raw scores.

- [ ] Task 16: Update ListArticlesQuery with mode support
  - File: `src/articles/queries/list-articles.query.ts`
  - Action:
    1. Extract `mode` param from request
    2. If mode='semantic' or 'hybrid', generate query embedding via AiService:
       ```typescript
       const queryText = `query: ${searchTerm}`;
       const queryEmbedding = await this.aiService.getEmbedding(queryText);
       ```
    3. For semantic-only: call `searchArticlesSemantic()` with filters
    4. For hybrid: call both search methods, apply RRF fusion, merge results
    5. Read RRF constant `k` from ConfigService (add `getRrfK()` method returning `process.env.RRF_K || 60`)
    6. Handle null embedding response (API failure): fallback to keyword-only, add warning to response
  - Notes: Default to 'keyword' mode. Inject AiService for query embedding generation.

- [ ] Task 16.1: Handle empty embeddings scenario
  - File: `src/articles/queries/list-articles.query.ts`
  - Action: Add check before semantic/hybrid search:
    ```typescript
    // Check if any articles have embeddings
    const articlesWithEmbeddings = await this.service.countTotalArticlesSemantic(options);
    if (articlesWithEmbeddings === 0) {
      // No embeddings available, fallback to keyword
      return {
        ...keywordResponse,
        warning: 'Semantic search unavailable: no embeddings found. Results are keyword-only.'
      };
    }
    ```
  - Notes: Prevents confusing empty results when semantic search is requested but no embeddings exist.

- [ ] Task 17: Add on-demand backfill trigger to search
  - File: `src/articles/queries/list-articles.query.ts` or `src/articles/articles.service.ts`
  - Action: When searching, detect articles with null `embedding_vector`, log warning, and queue background embedding job
  - Notes: Don't block search - return results immediately, queue jobs asynchronously. Implement throttling:
    1. Limit to max 10 backfill jobs per search request to avoid API rate limits
    2. Use BullMQ job ID deduplication: set `jobId: 'embedding-${articleId}'` to prevent duplicate jobs for same article
    3. Prioritize articles returned in top results (they're more relevant to the user)

- [ ] Task 18: Update ListArticlesRequest type
  - File: `src/articles/queries/list-articles.query.ts`
  - Action: Add `mode?: 'keyword' | 'semantic' | 'hybrid'` to ListArticlesRequest type

- [ ] Task 19: Update ListArticlesResponse type
  - File: `src/articles/queries/list-articles.query.ts`
  - Action: Add `mode: string` to filters and optional `warning?: string` for degraded mode notifications

- [ ] Task 20: Import AiModule in ArticlesModule
  - File: `src/articles/articles.module.ts`
  - Action: Add `AiModule` to imports array so `ListArticlesQuery` can inject `AiService` for query embedding generation
  - Notes: AiModule is in `@libs/ai` or `src/ai/ai.module.ts`

**Phase 5: Testing**

- [ ] Task 21: Create test fixtures for embedding tests
  - File: `test/fixtures/embeddings/test-articles.json` (new file, create directory structure)
  - Action:
    1. Create `test/fixtures/embeddings/` directory
    2. Create fixture file with 5 test articles and their pre-computed embeddings
    3. Create a script `test/fixtures/embeddings/generate-fixtures.ts` to regenerate embeddings:
       ```typescript
       // Run with: pnpm ts-node test/fixtures/embeddings/generate-fixtures.ts
       // Calls Together.xyz API and saves embeddings to JSON
       ```
  - Notes: Store pre-computed E5-large embeddings as number arrays. Mock `AiService.getEmbedding()` for unit tests to ensure determinism. Regenerate fixtures if model changes.

- [ ] Task 21.1: Add test database seeding helper
  - File: `test/helpers/seed-test-articles.ts` (new file)
  - Action: Create helper function to seed test DB with fixture articles:
    ```typescript
    export async function seedTestArticles(
      db: DatabaseService,
      articles: TestArticle[]
    ): Promise<void> {
      // Insert articles with pre-computed embeddings
    }
    ```
  - Notes: Used by integration tests to set up known state.

- [ ] Task 22: Add unit tests for embedding validation
  - File: `src/articles/helpers/validate-embedding.spec.ts` (new file)
  - Action: Test:
    - Valid 1024-element array of floats passes
    - Wrong length fails
    - Non-array fails
    - Array with NaN/Infinity fails
    - Array with non-numbers fails

- [ ] Task 23: Add unit tests for ArticlesService vector methods
  - File: `src/articles/articles.service.spec.ts` (new file)
  - Action: Test:
    - `updateArticleEmbedding` updates correct column
    - `searchArticlesSemantic` returns ordered results with filters applied
    - `searchArticlesKeywordWithRank` returns ranks correctly
    - `searchArticlesSemantic` throws on invalid embedding

- [ ] Task 24: Add unit tests for RRF fusion
  - File: `src/articles/helpers/reciprocal-rank-fusion.spec.ts` (new file)
  - Action: Test RRF algorithm with known inputs:
    - Keyword-only results (no semantic match)
    - Semantic-only results (no keyword match)
    - Overlapping results get summed scores
    - Correct ranking with different k values

- [ ] Task 25: Add unit tests for embedding processor retry logic
  - File: `libs/queue/processors/embedding-generation.processor.spec.ts` (new file)
  - Action: Test:
    - Processor retries on transient API failures
    - Processor fails after max attempts
    - Null/empty content handled gracefully
    - DB write failure triggers retry
    - Invalid embedding from API is rejected (not retried)

- [ ] Task 26: Add integration tests for search modes
  - File: `test/articles-search.e2e-spec.ts` (new file)
  - Action: E2E tests for:
    - Keyword mode returns exact matches
    - Semantic mode returns similar concepts
    - Hybrid mode combines both
    - Missing embedding fallback works
    - Filters work in all modes
    - Pagination works with vector search
  - Notes: Requires pgvector extension in test DB. Use seed helper from Task 21.1.

### Acceptance Criteria

- [ ] AC 1: Given the database has pgvector extension enabled, when migration runs, then articles table has `embedding_vector vector(1024)` column with IVFFlat index (lists=1 for sparse initial data).

- [ ] AC 1.1: Given existing articles have JSON embeddings in `embedding` TEXT column, when migration runs, then `embedding_vector` is populated with parsed vector values.

- [ ] AC 2: Given an article has no embedding_vector, when user performs semantic search, then the search returns results from articles with embeddings and queues a background job to generate the missing embedding.

- [ ] AC 2.1: Given a backfill job is already queued for an article, when another search triggers backfill for same article, then no duplicate job is created.

- [ ] AC 2.2: Given the embedding queue processes jobs, when rate limit is reached, then jobs are delayed automatically without errors.

- [ ] AC 3: Given test articles with pre-computed embeddings where "Introduction to Neural Networks" is semantically closer to "machine learning" than "Cooking Italian Pasta", when mode is 'semantic' and query is "machine learning algorithms", then the neural networks article has a higher similarity score than the cooking article.

- [ ] AC 4: Given a search query "React hooks", when mode is 'hybrid', then results combine keyword relevance (title/content match) and semantic similarity using RRF with correct rank-based scoring.

- [ ] AC 5: Given mode is 'keyword' (default), when user searches, then no embedding API call is made and results match current LIKE query behavior.

- [ ] AC 6: Given the embedding generation queue processes a job, when job completes, then article's `embedding_vector` column is updated with the generated embedding.

- [ ] AC 6.1: Given the embedding API fails transiently, when processor retries, then it attempts up to 3 times with exponential backoff before failing.

- [ ] AC 6.2: Given the DB write fails after successful embedding generation, when processor retries, then it attempts the DB write again without regenerating the embedding.

- [ ] AC 7: Given an article has only title (no processed_content), when embedding is generated, then embedding is created from title only.

- [ ] AC 8: Given semantic search with pagination params (page=2, perPage=10), when query executes, then correct offset is applied and pagination metadata is accurate.

- [ ] AC 9: Given mode is 'semantic' or 'hybrid' and embedding generation fails (API error, timeout, etc.), when search executes, then fallback to keyword-only results and log the error.

- [ ] AC 9.1: Given mode is 'semantic' and zero articles have embeddings, when search executes, then return keyword results with warning in response.

- [ ] AC 10: Given test fixtures with known embeddings, when integration tests run, then semantic ranking matches expected order deterministically using mocked embeddings.

- [ ] AC 11: Given semantic search with feedProfile filter, when query executes, then only articles matching the filter are returned (filters are applied correctly).

- [ ] AC 12: Given an invalid embedding (wrong length, NaN values, or non-array) is passed to `searchArticlesSemantic()`, when called, then it throws a BadRequestException without executing SQL.

## Additional Context

### Dependencies

**NPM Packages to Add:**
- None required (pgvector is a PostgreSQL extension, not an NPM package)

**PostgreSQL Extension:**
- `pgvector` — must be installed and enabled in PostgreSQL

**Existing Dependencies to Use:**
- `pg` (already installed) — supports pgvector via raw SQL
- `AiService.getEmbedding()` — already has embedding generation
- `BullMQ` — already configured for background jobs

### Testing Strategy

**Level 1: Unit Tests (Pure Logic)**
- Test embedding text preparation (`title + processed_content` concatenation)
- Test RRF score calculation with known rank positions
- Test hybrid mode fallback when embedding missing
- Test embedding vector validation (only valid floats)
- No external API calls, deterministic

**Level 2: Integration Tests (With Fixture Embeddings)**
- Seed test DB with 5-10 known articles from fixtures
- Pre-computed embeddings stored in `test/fixtures/embeddings/`
- Query with known semantic matches (e.g., "machine learning" → finds "neural networks" article)
- Assert ranking order matches expected similarity
- Test hybrid vs semantic vs keyword mode differences

**Test Data:**
```
Article 1: "Introduction to Neural Networks" (ML topic)
Article 2: "Deep Learning Best Practices" (ML topic)
Article 3: "React Hooks Tutorial" (Frontend topic)
Article 4: "TypeScript Generics Explained" (Frontend topic)
Article 5: "Cooking Italian Pasta" (Unrelated control)

Query: "machine learning algorithms"
Expected: Articles 1, 2 ranked highest (semantic match)
```

**Key Test Cases:**
- Semantic query returns semantically similar results, not just keyword matches
- Keyword-only mode works without embeddings
- Hybrid mode blends both signals correctly via RRF
- Missing embedding falls back gracefully (logged, not error)
- Pagination works with vector search
- Filters are applied correctly in all modes
- Invalid embeddings are rejected before SQL execution

### Notes

**Key Implementation Details:**

1. **Database layer uses raw SQL with callbacks** — ArticlesService does not use TypeORM entities for queries, only for migrations. New methods should follow the same pattern.

2. **CQRS pattern** — ListArticlesQuery handles the endpoint logic. Add `mode` param here, delegate to ArticlesService for actual search.

3. **Existing embedding TEXT column** — Keep `embedding` column as-is, add new `embedding_vector vector(1024)` column. One-time migration parses JSON and populates vector column.

4. **E5 model prefix** — For document embeddings (backfill), use `passage:` prefix (handled by AiService default). For search query embeddings, prepend `query:` prefix manually before calling `getEmbedding()`.

5. **On-demand backfill via BullMQ** — Create a new queue `EMBEDDING_GENERATION_QUEUE` with processor that calls AiService.getEmbedding() and updates the article's embedding_vector column.

6. **SQL injection prevention** — Always validate embeddings with `isValidEmbeddingVector()` before interpolating into SQL. Never trust external API responses directly.

7. **Filter consistency** — All search modes (keyword, semantic, hybrid) must apply the same filters (feedProfile, startDate, endDate, category) for consistent behavior.

8. **RRF scoring** — Use rank positions (1, 2, 3...), not raw similarity scores. Both keyword and semantic results are ranked, then RRF applied to positions.

**Risk Assessment:**

| Risk                                        | Impact | Mitigation                                                   |
| ------------------------------------------- | ------ | ------------------------------------------------------------ |
| Embedding API rate limits during backfill   | High   | Queue rate limiting configured (10 jobs/min), BullMQ limiter |
| IVFFlat index accuracy with sparse vectors  | Medium | Monitor recall, tune `lists` parameter as data grows         |
| RRF tuning for result quality               | Medium | Make k configurable via env var, A/B test                    |
| Missing embeddings causing partial results  | Low    | Graceful fallback to keyword, warning in response            |
| SQL injection via malformed embeddings      | High   | Validate embedding array before any SQL interpolation        |
| DB write failure after embedding generation | Medium | Retry logic in processor, log failures for manual review     |
| Empty embeddings causing confusing results  | Medium | Check count before semantic search, add warning to response  |

**Future Considerations:**

- Migrate from IVFFlat to HNSW index when you have 10k+ vectors for better recall
- Consider batching embedding generation for initial bulk backfill
- Monitor connection pool usage — vector operations are heavier than keyword queries
- Add admin endpoint to trigger re-embedding for stale content
- Consider caching query embeddings for repeated searches

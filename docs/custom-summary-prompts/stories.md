# Story Creation for Custom Summary Prompts

Let me analyze the PRD and project documentation to create implementation-ready stories following the suggested story breakdown from the PRD.

I'll work through each story systematically, using the PRD's FR groupings and enriching them with architecture/codebase intelligence from your project docs.

---

## Story 1: Database Migrations

### Story 1-1: Add `custom_prompt` Column to Articles and YouTube Transcriptions Tables

**Epic:** Custom Summary Prompts
**Story Key:** `1-1-database-migrations-custom-prompt`
**Status:** `ready-for-dev`

---

### Story Statement

**As a** system
**I want** nullable `custom_prompt` text columns on the `articles` and `youtube_transcriptions` tables
**So that** per-item custom summarization instructions can be persisted alongside content records

---

### Acceptance Criteria

- [ ] A new TypeORM migration adds a nullable `custom_prompt` column of type `text` to the `articles` table
- [ ] A new TypeORM migration adds a nullable `custom_prompt` column of type `text` to the `youtube_transcriptions` table
- [ ] Both migrations can be run via `pnpm run migration:run` without errors
- [ ] Both migrations can be reverted via `pnpm run migration:revert` without errors
- [ ] Existing rows in both tables have `NULL` for `custom_prompt` after migration (FR14)
- [ ] No existing columns are modified or removed (non-destructive migration)
- [ ] The `DBArticle` interface includes the new `custom_prompt` field as an optional property
- [ ] The `DBYoutubeTranscription` interface includes the new `custom_prompt` field as an optional property

---

### Developer Context

**Business Goal:** This is the foundational data layer change. Every other story in this epic depends on these columns existing. The migration must be non-destructive to preserve backward compatibility (FR12, FR13, FR14).

**Why two columns, not a shared table:** The PRD explicitly scopes this to direct columns on existing tables. No join tables, no polymorphic prompt storage. Keep it simple.

---

### Technical Requirements

**Migration Location:** `src/database/migrations/`
*(Source: DEVELOPER_GUIDE.md → Database Operations → Migration File Structure)*

**Migration Command:**
```bash
pnpm run migration:create src/database/migrations/AddCustomPromptToArticles
pnpm run migration:create src/database/migrations/AddCustomPromptToYoutubeTranscriptions
```

Alternatively, a single migration file can handle both tables if preferred — the PRD says "2 database migrations (one per table)" but a single migration with two `ALTER TABLE` statements is also acceptable as long as revert drops both.

**Interface Updates:**

The project uses raw SQL with interfaces, not TypeORM entity decorators. Update the interfaces that map to DB rows:

In `DBArticle` (`src/articles/article.entity.ts`):
```typescript
custom_prompt?: string | null;
```

In `DBYoutubeTranscription` and `YoutubeTranscription` (`src/youtube-transcriptions/entities/youtube-transcription.entity.ts`):
```typescript
custom_prompt?: string | null;
```

Also update `ArticleRow` in `ArticlesService` and any other interfaces that represent article/transcription rows to include `custom_prompt`.

**Migration SQL pattern:**
```sql
-- UP
ALTER TABLE "articles" ADD COLUMN "custom_prompt" text;
ALTER TABLE "youtube_transcriptions" ADD COLUMN "custom_prompt" text;

-- DOWN
ALTER TABLE "articles" DROP COLUMN "custom_prompt";
ALTER TABLE "youtube_transcriptions" DROP COLUMN "custom_prompt";
```

---

### Architecture Compliance

| Requirement                                        | Compliance                                                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| PostgreSQL + TypeORM migrations                    | ✅ Standard migration path in `src/database/migrations/`                                           |
| UUID primary keys                                  | N/A — no new tables                                                                               |
| Nullable column addition                           | ✅ Non-destructive, backward compatible                                                            |
| Global `DatabaseModule` runs migrations on startup | ✅ Migration will auto-apply on next deploy *(Source: LIBRARIES.md → Database Library → Behavior)* |

---

### Testing Requirements

- Verify migration runs successfully on a clean database
- Verify migration runs successfully on a database with existing article/transcription rows
- Verify existing rows have `NULL` for `custom_prompt`
- Verify migration revert removes the columns cleanly
- Verify interface type definitions compile without errors

---

### Scope Boundaries

- **DO:** Add columns and update entity definitions only
- **DO NOT:** Modify any DTOs, controllers, services, or API responses in this story
- **DO NOT:** Add validation logic — that belongs to Story 2/3

---

### Functional Requirements Covered

| FR   | Description                                           | Status                  |
| ---- | ----------------------------------------------------- | ----------------------- |
| FR4  | System persists custom prompt on article record       | Schema ready            |
| FR9  | System persists custom prompt on transcription record | Schema ready            |
| FR14 | Existing records return null for custom_prompt        | Nullable column default |

---

### Completion Checklist

- [ ] Migration file(s) created in `src/database/migrations/`
- [ ] `DBArticle` and `ArticleRow` interfaces updated with `custom_prompt` field
- [ ] `DBYoutubeTranscription` and `YoutubeTranscription` interfaces updated with `custom_prompt` field
- [ ] `pnpm run migration:run` succeeds
- [ ] `pnpm run migration:revert` succeeds
- [ ] `pnpm run build` compiles without errors
- [ ] Existing tests pass (`pnpm run test`)

---

---

## Story 2: Article Creation + Processing Changes

### Story 1-2: Accept and Process Custom Prompt for Articles

**Epic:** Custom Summary Prompts
**Story Key:** `1-2-article-custom-prompt-creation-processing`
**Status:** `ready-for-dev`

---

### Story Statement

**As a** user
**I want** to provide an optional custom prompt when adding an article (via URL or markdown)
**So that** the AI summarization reflects my specific intent for that content

---

### Acceptance Criteria

- [ ] `POST /api/articles` accepts an optional `customPrompt` string field in the request body (FR1)
- [ ] `POST /api/articles/markdown` accepts an optional `customPrompt` string field in the request body (FR2)
- [ ] `POST /api/articles/external` accepts an optional `customPrompt` string field in the request body
- [ ] `customPrompt` is validated: optional, string, max 500 characters (FR17)
- [ ] Requests with `customPrompt` exceeding 500 characters receive a `400 Bad Request` error (FR18)
- [ ] The `custom_prompt` value is saved to the article record in the database (FR4)
- [ ] When `custom_prompt` is present on the article, the article processing pipeline appends it to the base feed-profile prompt (FR3)
- [ ] Prompt concatenation uses the format: `base_profile_prompt + "\n\nAdditional instructions: " + custom_prompt` (FR15)
- [ ] Prompt concatenation is handled by a shared utility function (FR16)
- [ ] Articles created without `customPrompt` behave identically to current behavior (FR12)
- [ ] URL articles: No changes to article job payload — processor reads `custom_prompt` from the database record
- [ ] Markdown articles: `customPrompt` must be passed in the markdown job payload (article is created in the processor, so it does not exist when the job is queued)

---

### Developer Context

**Business Goal:** Users adding tutorials want step extraction, users adding tool reviews want applicability analysis. This lets them express that intent per-article without changing their feed profile prompt.

**Data Flow — URL articles:**
```
User Request (with optional customPrompt)
    → Controller validates input
    → ScraperService.scrapeSingleArticle() creates article via ArticlesService.addArticle() with custom_prompt
    → Job queued with article ID only (no customPrompt in payload)
    → ProcessorService.processArticles() fetches article, reads custom_prompt from DB
    → buildFinalPrompt(basePrompt, article.custom_prompt)
    → AI summarization with combined prompt
    → Summary stored on record
```

**Data Flow — Markdown articles:**
```
User Request (with optional customPrompt)
    → Controller validates input
    → Job queued with s3Bucket, s3Key, feedProfile, customPrompt (article does not exist yet)
    → Markdown processor creates article via ArticlesService.addArticle() with custom_prompt
    → ProcessorService.processArticles() fetches article, reads custom_prompt from DB
    → Same prompt concatenation as URL articles
```

**Key Implementation Insight:** Summarization happens in `ProcessorService.processArticles()` in `src/processor/processor.service.ts`, not in the queue processors. The article and markdown processors only call `processorService.processArticles()`. For URL articles, the article exists before the job runs, so no job payload change. For markdown articles, the article is created inside the processor, so `customPrompt` must be in the markdown job payload and passed to `addArticle()`.

---

### Technical Requirements

#### 1. DTO Changes

Update the article creation DTO(s) (likely `src/articles/dto/create-article.dto.ts` or equivalent):

```typescript
@IsOptional()
@IsString()
@MaxLength(500)
customPrompt?: string;
```

Similarly update the markdown article DTO and external article DTO.

*(Source: DEVELOPER_GUIDE.md → Best Practices → Use DTOs for API Contracts)*

#### 2. Controller Changes

**URL articles** (`src/articles/articles.controller.ts` — `POST /api/articles`): Pass `customPrompt` from DTO to `scraperService.scrapeSingleArticle(url, feedProfile, customPrompt)`.

**External articles** (`src/articles/external-articles.controller.ts` — `POST /api/articles/external`): Add `customPrompt` to `ExternalCreateArticleDto`, pass to `scrapeSingleArticle(url, feedProfile, customPrompt)`.

**Markdown articles** (`src/articles/articles.controller.ts` — `POST /api/articles/markdown`): Pass `customPrompt` from DTO to `queueService.addMarkdownArticleProcessingJob(bucketName, s3Key, feedProfile, customPrompt)`.

#### 3. Service Changes

**ScraperService** (`src/scraper/scraper.service.ts`): Add optional `customPrompt` parameter to `scrapeSingleArticle(url, feedProfile, customPrompt?)` and pass it to `addArticle()`.

**ArticlesService** (`src/articles/articles.service.ts`): Add optional `customPrompt` parameter to `addArticle()` and include `custom_prompt` in the INSERT statement.

#### 4. Shared Prompt Concatenation Utility

Create a utility function accessible by both the article processor and the YouTube transcription processor (Story 3):

**Suggested location:** `src/shared/utils/prompt.utils.ts` (create the `utils` folder if it does not exist)

```typescript
export function buildFinalPrompt(basePrompt: string, customPrompt?: string | null): string {
  if (!customPrompt?.trim()) {
    return basePrompt;
  }
  return `${basePrompt}\n\nAdditional instructions: ${customPrompt}`;
}
```

*(Source: PRD → Prompt Concatenation Logic, FR15, FR16)*

#### 5. ProcessorService Changes (Prompt Concatenation)

**File:** `src/processor/processor.service.ts`

Summarization happens in `processArticles()`, not in the queue processors. In the loop where `summaryPrompt` is built (around line 67–74), replace:

```typescript
const summaryPrompt = profilePrompts.articleSummary
  ? this.configService.formatPrompt(profilePrompts.articleSummary, { ... })
  : this.configService.getArticleSummaryPrompt(...);
```

With:

```typescript
import { buildFinalPrompt } from '<path>/prompt.utils';

const basePrompt = profilePrompts.articleSummary
  ? this.configService.formatPrompt(profilePrompts.articleSummary, { article_content: article.raw_content.substring(0, 4000) })
  : this.configService.getArticleSummaryPrompt(article.raw_content.substring(0, 4000));
const summaryPrompt = buildFinalPrompt(basePrompt, article.custom_prompt);
```

**Critical:** When `custom_prompt` is null/empty, `buildFinalPrompt` returns `basePrompt` exactly — ensuring zero behavioral change for existing articles. The `article` object comes from `getUnprocessedArticleById()`; ensure the query returns `custom_prompt` (e.g. `SELECT *` or explicit column list including `custom_prompt`).

#### 6. Markdown Job Payload and Processor

**Files:**
- `libs/queue/interfaces/markdown-article-job.interface.ts` — Add `customPrompt?: string` to `ProcessMarkdownArticleJobData`
- `libs/queue/queue.service.ts` — Add `customPrompt` parameter to `addMarkdownArticleProcessingJob()` and include it in job data
- `src/articles/articles.controller.ts` — Pass `customPrompt` from DTO to `addMarkdownArticleProcessingJob()`
- `src/articles/processors/markdown-article.processor.ts` — Pass `job.data.customPrompt` to `articlesService.addArticle()` when creating the article

**Note:** The article and markdown queue processors do NOT need to call `buildFinalPrompt` — they delegate to `ProcessorService.processArticles()`, which handles it.

---

### Architecture Compliance

| Requirement                                      | Compliance                                            |
| ------------------------------------------------ | ----------------------------------------------------- |
| NestJS controller → service → repository pattern | ✅ Standard flow                                       |
| URL article job payload unchanged                 | ✅ Processor reads `custom_prompt` from DB record       |
| Markdown job payload extended with customPrompt   | ✅ Article created in processor; customPrompt needed   |
| DTO validation with class-validator              | ✅ `@IsOptional()`, `@IsString()`, `@MaxLength(500)`   |
| Shared utility for prompt concatenation          | ✅ Single function reused by both pipelines (FR16)     |
| AI provider calls via `AiService`                | ✅ Only the prompt input changes, not the call pattern |

---

### Library & Framework Requirements

| Dependency          | Usage                                             | Notes              |
| ------------------- | ------------------------------------------------- | ------------------ |
| `class-validator`   | `@MaxLength(500)`, `@IsOptional()`, `@IsString()` | Already in project |
| `class-transformer` | DTO transformation                                | Already in project |
| Raw SQL             | Article/transcription row interfaces              | `ArticleRow`, `DBArticle` |

---

### File Structure

| File                                                              | Action                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/articles/dto/create-article.dto.ts`                          | **Modify** — add `customPrompt` field                        |
| `src/articles/dto/process-markdown-article.dto.ts`                 | **Modify** — add `customPrompt` field                        |
| `src/articles/dto/external-create-article.dto.ts`                 | **Modify** — add `customPrompt` field                        |
| `src/articles/articles.controller.ts`                             | **Modify** — pass `customPrompt` to scraper and queue        |
| `src/articles/external-articles.controller.ts`                    | **Modify** — pass `customPrompt` to scraper                  |
| `src/scraper/scraper.service.ts`                                  | **Modify** — add `customPrompt` param to `scrapeSingleArticle` |
| `src/articles/articles.service.ts`                                | **Modify** — add `customPrompt` param to `addArticle`, persist |
| `src/processor/processor.service.ts`                              | **Modify** — use `buildFinalPrompt` in summarization step    |
| `libs/queue/interfaces/markdown-article-job.interface.ts`         | **Modify** — add `customPrompt` to job data                  |
| `libs/queue/queue.service.ts`                                    | **Modify** — add `customPrompt` to `addMarkdownArticleProcessingJob` |
| `src/articles/processors/markdown-article.processor.ts`           | **Modify** — pass `customPrompt` to `addArticle`             |
| `src/shared/utils/prompt.utils.ts`                               | **Create** — shared prompt concatenation utility             |

---

### Testing Requirements

**Unit Tests:**
- `buildFinalPrompt` utility: test with null, empty string, whitespace-only, and valid custom prompt
- Article service: test that `custom_prompt` is persisted when provided and null when omitted
- DTO validation: test that strings > 500 chars are rejected

**Processor Tests:**
- ProcessorService: test that `buildFinalPrompt` is called with `article.custom_prompt` when building summary prompt
- Test that null `custom_prompt` results in unchanged base prompt

**E2E/Integration:**
- `POST /api/articles` with `customPrompt` → article record has `custom_prompt` set
- `POST /api/articles` without `customPrompt` → article record has `custom_prompt` as null
- `POST /api/articles/markdown` with `customPrompt` → article record has `custom_prompt` set
- `POST /api/articles` with `customPrompt` > 500 chars → 400 error

---

### Scope Boundaries

- **DO:** Add `customPrompt` to creation endpoints, persist it, use it in processing
- **DO:** Create the shared utility function
- **DO NOT:** Modify GET response shapes — that's Story 4
- **DO NOT:** Add prompt template library features — that's post-MVP

---

### Previous Story Intelligence

**Depends on:** Story 1-1 (database migrations). The `custom_prompt` column must exist on the `articles` table before this story can persist data.

**Shared artifact:** The `buildFinalPrompt` utility created here will be reused by Story 1-3 (YouTube transcription processing).

---

### Functional Requirements Covered

| FR   | Description                                                         |
| ---- | ------------------------------------------------------------------- |
| FR1  | Optional custom prompt when creating article via URL                |
| FR2  | Optional custom prompt when creating article via markdown upload    |
| FR3  | System appends custom prompt to base prompt during AI summarization |
| FR4  | System persists custom prompt on article record                     |
| FR12 | Articles without custom prompt behave identically                   |
| FR15 | Concatenation with clear delimiter                                  |
| FR16 | Shared utility function for concatenation                           |
| FR17 | Optional text field up to 500 characters                            |
| FR18 | Reject prompts exceeding max length with 400                        |

---

### Completion Checklist

- [ ] Article creation DTO(s) updated with `customPrompt` validation
- [ ] Controllers pass `customPrompt` to scraper (URL/external) and queue (markdown)
- [ ] ScraperService.scrapeSingleArticle accepts and passes through customPrompt
- [ ] ArticlesService.addArticle accepts and persists `custom_prompt`
- [ ] Markdown job payload includes customPrompt; processor passes it to addArticle
- [ ] `buildFinalPrompt` utility created and tested
- [ ] ProcessorService.processArticles uses `buildFinalPrompt`
- [ ] Unit tests for utility, service, and processors
- [ ] E2E test for creation with and without custom prompt
- [ ] `pnpm run build` compiles without errors
- [ ] `pnpm run test` passes

---

---

## Story 3: YouTube Transcription Creation + Processing Changes

### Story 1-3: Accept and Process Custom Prompt for YouTube Transcriptions

**Epic:** Custom Summary Prompts
**Story Key:** `1-3-transcription-custom-prompt-creation-processing`
**Status:** `ready-for-dev`

---

### Story Statement

**As a** user
**I want** to provide an optional custom prompt when adding a YouTube video for transcription
**So that** the transcription summary focuses on aspects relevant to my specific needs

---

### Acceptance Criteria

- [ ] `POST /api/youtube/transcriptions` accepts an optional `customPrompt` string field in the request body (FR7)
- [ ] `customPrompt` is validated: optional, string, max 500 characters (FR17)
- [ ] Requests with `customPrompt` exceeding 500 characters receive a `400 Bad Request` error (FR18)
- [ ] The `custom_prompt` value is saved to the transcription record in the database (FR9)
- [ ] When `custom_prompt` is present on the transcription, the summary processor appends it to the base prompt (FR8)
- [ ] Prompt concatenation uses the shared `buildFinalPrompt` utility from Story 1-2 (FR15, FR16)
- [ ] Transcriptions created without `customPrompt` behave identically to current behavior (FR13)

---

### Developer Context

**Business Goal:** A user watching an AI coding tool review wants the summary to focus on NestJS backend applicability, not a generic overview. This mirrors the article feature but for the YouTube transcription pipeline.

**Key difference from articles:** The YouTube transcription flow has a different processing path. The transcript is extracted first, then a summary job is queued to `youtube-transcription-summary`. The `custom_prompt` must be available when the summary processor runs.

*(Source: ARCHITECTURE.md → Core Processing Flows → YouTube transcription flow)*

---

### Technical Requirements

#### 1. DTO Changes

Update the transcription creation DTO (likely in `src/youtube-transcriptions/dto/`):

```typescript
@IsOptional()
@IsString()
@MaxLength(500)
customPrompt?: string;
```

#### 2. Controller and Command Changes

**File:** `src/youtube-transcriptions/youtube-transcriptions.controller.ts` — Pass `customPrompt` from DTO to `CreateYoutubeTranscriptionCommand.execute()`.

**File:** `src/youtube-transcriptions/commands/create-youtube-transcription.command.ts` — Add `customPrompt` to `CreateYoutubeTranscriptionCommandInput`, pass to `service.processSingleVideoUrl(url, channelId, proxyUrl, customPrompt)` (add as 4th parameter; existing 3rd param is optional `proxyUrl`).

#### 3. Service Changes

**YoutubeTranscriptionsService** (`src/youtube-transcriptions/services/youtube-transcriptions.service.ts`):

- `processSingleVideoUrl(videoUrl, channelId, proxyUrl?, customPrompt?)`: Add optional `customPrompt` as 4th parameter, pass to `addTranscription()`.
- `addTranscription(videoData, transcriptionSummary?, customPrompt?)`: Add optional `customPrompt` parameter, include `custom_prompt` in the INSERT statement.

#### 4. Processor Changes

**File:** `src/youtube-transcriptions/processors/youtube-transcription.processor.ts`

The processor receives `transcriptionId` in the job. The transcription record (with `custom_prompt`) exists in the DB before the summary job runs. The processor must:

1. Fetch the transcription: `await this.youtubeTranscriptionsService.getTranscriptionById(transcriptionId)` to get `custom_prompt`.
2. Build the final prompt: `buildFinalPrompt(basePrompt, transcription.custom_prompt)`.
3. Ensure `getTranscriptionById` returns `custom_prompt` (add to SELECT and interface).

```typescript
import { buildFinalPrompt } from '<path>/prompt.utils';

const transcription = await this.youtubeTranscriptionsService.getTranscriptionById(transcriptionId);
const basePrompt = this.configService.getTranscriptionSummaryPrompt(transcriptText);
const finalPrompt = buildFinalPrompt(basePrompt, transcription?.custom_prompt ?? null);
const summary = await this.aiService.callDeepseekChat(finalPrompt);
```

**Note:** Reuse the `buildFinalPrompt` utility created in Story 1-2. Do NOT create a duplicate.

---

### Architecture Compliance

| Requirement                         | Compliance                                       |
| ----------------------------------- | ------------------------------------------------ |
| NestJS controller → service pattern | ✅                                                |
| BullMQ job payload unchanged        | ✅ Processor reads `custom_prompt` from DB record |
| Shared `buildFinalPrompt` utility   | ✅ Reuse from Story 1-2                           |
| DTO validation                      | ✅ class-validator decorators                     |

---

### File Structure

| File                                                                       | Action                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/youtube-transcriptions/dto/create-youtube-transcription.dto.ts`      | **Modify** — add `customPrompt` field                        |
| `src/youtube-transcriptions/youtube-transcriptions.controller.ts`         | **Modify** — pass `customPrompt` to command                  |
| `src/youtube-transcriptions/commands/create-youtube-transcription.command.ts` | **Modify** — add `customPrompt` to input, pass to service |
| `src/youtube-transcriptions/services/youtube-transcriptions.service.ts`   | **Modify** — `processSingleVideoUrl` and `addTranscription` accept and persist `custom_prompt` |
| `src/youtube-transcriptions/processors/youtube-transcription.processor.ts` | **Modify** — fetch transcription by ID, use `buildFinalPrompt` |

---

### Testing Requirements

**Unit Tests:**
- Transcription service: `custom_prompt` persisted when provided, null when omitted
- DTO validation: > 500 chars rejected
- Transcription summary processor: `buildFinalPrompt` called with `transcription.custom_prompt`
- Processor with null `custom_prompt`: base prompt used unchanged

**E2E/Integration:**
- `POST /api/youtube/transcriptions` with `customPrompt` → record has `custom_prompt`
- `POST /api/youtube/transcriptions` without `customPrompt` → record has null `custom_prompt`
- `POST /api/youtube/transcriptions` with > 500 char prompt → 400 error

---

### Scope Boundaries

- **DO:** Add `customPrompt` to transcription creation, persist it, use it in summary processing
- **DO NOT:** Modify GET responses — that's Story 4
- **DO NOT:** Duplicate the `buildFinalPrompt` utility — import from Story 1-2's location

---

### Previous Story Intelligence

**Depends on:**
- Story 1-1: `custom_prompt` column must exist on `youtube_transcriptions` table
- Story 1-2: `buildFinalPrompt` utility must be available for import

**Pattern to follow:** Mirror exactly the approach used in Story 1-2 for articles. Same DTO validation decorators, same service persistence pattern, same processor integration.

---

### Functional Requirements Covered

| FR   | Description                                                      |
| ---- | ---------------------------------------------------------------- |
| FR7  | Optional custom prompt when creating YouTube transcription       |
| FR8  | System appends custom prompt to base prompt during summarization |
| FR9  | System persists custom prompt on transcription record            |
| FR13 | Transcriptions without custom prompt behave identically          |
| FR15 | Concatenation with clear delimiter (shared utility)              |
| FR16 | Shared utility function (reuse from Story 1-2)                   |
| FR17 | Optional text field up to 500 characters                         |
| FR18 | Reject prompts exceeding max length with 400                     |

---

### Completion Checklist

- [ ] Transcription creation DTO updated with `customPrompt` validation
- [ ] Controller passes `customPrompt` to command; command passes to service
- [ ] processSingleVideoUrl and addTranscription accept and persist `custom_prompt`
- [ ] YouTube transcription summary processor uses `buildFinalPrompt`
- [ ] Unit tests for service and processor
- [ ] E2E test for creation with and without custom prompt
- [ ] `pnpm run build` compiles without errors
- [ ] `pnpm run test` passes

---

---

## Story 4: GET Endpoint Response Updates

### Story 1-4: Return `custom_prompt` in Article and Transcription API Responses

**Epic:** Custom Summary Prompts
**Story Key:** `1-4-get-endpoints-custom-prompt-response`
**Status:** `ready-for-dev`

---

### Story Statement

**As a** user
**I want** to see the custom prompt that was used for any article or transcription when I retrieve them via API
**So that** I can remember what angle I requested and reuse similar instructions in the future

---

### Acceptance Criteria

- [ ] `GET /api/articles/:id` includes `custom_prompt` in the article response when present (FR5)
- [ ] `GET /api/articles` includes `custom_prompt` in each article item in the list response (FR6)
- [ ] `GET /api/youtube/transcriptions/:id` includes `custom_prompt` in the transcription response (FR10)
- [ ] `GET /api/youtube/transcriptions` includes `custom_prompt` in each transcription item in the list response (FR11)
- [ ] When `custom_prompt` is null (not set), the field is returned as `null` (not omitted) for consistency
- [ ] Existing articles and transcriptions (created before this feature) return `null` for `custom_prompt` (FR14)
- [ ] No existing response fields are removed or renamed — the new field is purely additive
- [ ] API response contracts remain backward-compatible

---

### Developer Context

**Business Goal:** Traceability. When a user sees an unusually detailed tutorial summary weeks later, they can check the `custom_prompt` field to see what instruction shaped it — and reuse it.

*(Source: PRD → Journey 4: Viewing a Previously Customized Article)*

**Implementation note:** The project uses raw SQL queries and query classes, not TypeORM entities. Responses are built from query results. Add `custom_prompt` to the SQL SELECT lists and to the interfaces used by the query classes.

---

### Technical Requirements

#### Article Responses

**`GET /api/articles/:id`** — Currently returns shape:
```json
{
  "article": { ... },
  "related_articles": []
}
```
*(Source: API_REFERENCE.md → GET /api/articles/:id)*

Add `custom_prompt` to the article object within the response.

**`GET /api/articles`** — Currently returns shape:
```json
{
  "articles": [ ... ],
  "pagination": { ... },
  "filters": { ... },
  ...
}
```
*(Source: API_REFERENCE.md → GET /api/articles)*

Add `custom_prompt` to each article object in the `articles` array.

#### Transcription Responses

**`GET /api/youtube/transcriptions/:id`** — Currently returns shape:
```json
{
  "transcription": { ... }
}
```
*(Source: API_REFERENCE.md → GET /api/youtube/transcriptions/:id)*

Add `custom_prompt` to the transcription object.

**`GET /api/youtube/transcriptions`** — Currently returns:
```json
{
  "transcriptions": [ ... ],
  "available_channels": [ ... ]
}
```
*(Source: API_REFERENCE.md → GET /api/youtube/transcriptions)*

Add `custom_prompt` to each transcription object in the `transcriptions` array.

#### Implementation Approach

The project uses query classes with raw SQL. Add `custom_prompt` to:

The query classes delegate to service methods. Ensure the following service methods include `custom_prompt` in their SQL SELECT and result mapping:

1. **Article detail:** `ArticlesService.getArticleById()` — used by `GetArticleByIdQuery`. Add `custom_prompt` to SELECT and `DBArticle`/result interface.

2. **Article list:** `ArticlesService.getArticlesPaginated()` — used by `ListArticlesQuery`. Add `custom_prompt` to SELECT.

3. **Transcription detail:** `YoutubeTranscriptionsService.getTranscriptionById()` — used by `GetYoutubeTranscriptionByIdQuery`. Add `custom_prompt` to SELECT and `YoutubeTranscription` interface.

4. **Transcription list:** `YoutubeTranscriptionsService.getAllTranscriptions()` and `getTranscriptionsPaginated()` (if used) — add `custom_prompt` to SELECT.

If any method uses `SELECT *`, the new column will be returned automatically after the migration; ensure the result interfaces include `custom_prompt?: string | null`. The query classes pass through the service response, so no query file changes are needed if the service returns the field.

---

### Architecture Compliance

| Requirement                                       | Compliance                                              |
| ------------------------------------------------- | ------------------------------------------------------- |
| Backward-compatible API response                  | ✅ Additive field only, no removals                      |
| Consistent field naming (snake_case in responses) | ✅ `custom_prompt` matches existing response conventions |

---

### File Structure

| File                                                                 | Action                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/articles/articles.service.ts`                                  | **Modify** — add `custom_prompt` to SELECT in `getArticleById` and `getArticlesPaginated` |
| `src/youtube-transcriptions/services/youtube-transcriptions.service.ts` | **Modify** — add `custom_prompt` to SELECT in `getTranscriptionById`, `getAllTranscriptions`, `getTranscriptionsPaginated` |

---

### Testing Requirements

**Unit Tests:**
- Article detail query/service: response includes `custom_prompt` when set
- Article detail query/service: response includes `custom_prompt: null` when not set
- Article list query/service: items include `custom_prompt`
- Transcription detail: includes `custom_prompt`
- Transcription list: items include `custom_prompt`

**E2E/Integration:**
- Create article with `customPrompt` → GET detail returns `custom_prompt`
- Create article without `customPrompt` → GET detail returns `custom_prompt: null`
- GET list includes `custom_prompt` in article items
- Same verifications for transcriptions

---

### Scope Boundaries

- **DO:** Surface `custom_prompt` in all 4 GET endpoints
- **DO NOT:** Add filtering by `custom_prompt` (that's Phase 2 / post-MVP)
- **DO NOT:** Add update/edit capabilities for `custom_prompt`

---

### Previous Story Intelligence

**Depends on:**
- Story 1-1: Column exists on tables; interfaces updated
- Stories 1-2/1-3: Data is being persisted (though GET responses can be built even if no records have the field yet)

---

### Functional Requirements Covered

| FR   | Description                                         |
| ---- | --------------------------------------------------- |
| FR5  | View custom prompt in article detail endpoint       |
| FR6  | View custom prompt in article list responses        |
| FR10 | View custom prompt in transcription detail endpoint |
| FR11 | View custom prompt in transcription list responses  |
| FR14 | Existing records return null for custom_prompt      |

---

### Completion Checklist

- [ ] `GET /api/articles/:id` response includes `custom_prompt`
- [ ] `GET /api/articles` list items include `custom_prompt`
- [ ] `GET /api/youtube/transcriptions/:id` response includes `custom_prompt`
- [ ] `GET /api/youtube/transcriptions` list items include `custom_prompt`
- [ ] Null values returned correctly for records without custom prompt
- [ ] No existing response fields affected
- [ ] Unit tests for all 4 endpoints
- [ ] E2E tests verifying field presence
- [ ] `pnpm run build` compiles without errors
- [ ] `pnpm run test` passes

---

---

## Story 5: Backward Compatibility Verification

### Story 1-5: Backward Compatibility Verification for Custom Summary Prompts

**Epic:** Custom Summary Prompts
**Story Key:** `1-5-backward-compatibility-verification`
**Status:** `ready-for-dev`

---

### Story Statement

**As a** system
**I want** verified backward compatibility across all endpoints and processing pipelines
**So that** existing API consumers and content processing continue to work identically after the custom prompt feature deployment

---

### Acceptance Criteria

- [ ] Articles created without `customPrompt` produce identical summaries to pre-feature behavior (FR12)
- [ ] Transcriptions created without `customPrompt` produce identical summaries to pre-feature behavior (FR13)
- [ ] Existing articles (created before migration) return `custom_prompt: null` in API responses (FR14)
- [ ] Existing transcriptions (created before migration) return `custom_prompt: null` in API responses (FR14)
- [ ] All existing API consumers continue to work without modification (no field removals, no type changes)
- [ ] Pipeline error rate is unchanged for items without custom prompts
- [ ] Pipeline retry and error handling behavior is identical regardless of custom prompt presence
- [ ] No existing unit or E2E tests are broken by the feature

---

### Developer Context

**Why this is a separate story:** The PRD identifies backward compatibility as a core success criterion. While each previous story includes some compatibility checks, this story provides a dedicated verification pass across the entire feature surface. Think of it as the integration/regression gate.

---

### Technical Requirements

#### Verification Areas

**1. API Contract Verification**

Verify that all existing API contracts are preserved:

| Endpoint                              | Verification                                                             |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `POST /api/articles`                  | Existing body without `customPrompt` works identically                   |
| `POST /api/articles/markdown`         | Existing body without `customPrompt` works identically                   |
| `POST /api/articles/external`         | Existing body without `customPrompt` works identically                   |
| `POST /api/youtube/transcriptions`    | Existing body without `customPrompt` works identically                   |
| `GET /api/articles`                   | Response shape is additive only (`custom_prompt` added, nothing removed) |
| `GET /api/articles/:id`               | Response shape is additive only                                          |
| `GET /api/youtube/transcriptions`     | Response shape is additive only                                          |
| `GET /api/youtube/transcriptions/:id` | Response shape is additive only                                          |

**2. Processing Pipeline Verification**

- Create an article WITHOUT `customPrompt` → verify the prompt sent to AI is exactly the base feed-profile prompt (no `\n\nAdditional instructions:` suffix)
- Create a transcription WITHOUT `customPrompt` → same verification
- Verify `buildFinalPrompt(basePrompt, null)` === `basePrompt`
- Verify `buildFinalPrompt(basePrompt, "")` === `basePrompt`
- Verify `buildFinalPrompt(basePrompt, "   ")` === `basePrompt`

**3. Database Verification**

- Existing article rows: `custom_prompt` is `NULL`
- Existing transcription rows: `custom_prompt` is `NULL`
- No schema changes to existing columns

**4. Full Regression**

- Run complete test suite: `pnpm run test`
- Run E2E tests: `pnpm run test:e2e`
- Zero test failures attributable to the custom prompt feature

---

### Testing Requirements

This story is primarily a testing story. Deliverables:

1. **Dedicated backward compatibility test file(s):**
   - `custom-prompt-backward-compat.spec.ts` (or similar)
   - Tests that explicitly verify null/missing `customPrompt` behavior

2. **Utility edge case tests:**
   - `buildFinalPrompt` with every null/empty/whitespace variant

3. **Integration tests:**
   - Full create → process → retrieve flow without `customPrompt`
   - Verify summary output matches pre-feature expectations

4. **Existing test suite pass:**
   - All pre-existing tests must pass without modification (unless a test was testing exact response shapes and the additive `custom_prompt: null` field causes a strict equality failure — in which case update the test expectation)

---

### Scope Boundaries

- **DO:** Write verification tests, run full regression, document results
- **DO:** Fix any backward compatibility issues discovered
- **DO NOT:** Add new features or modify the custom prompt behavior
- **DO NOT:** Modify existing tests unless strictly necessary due to additive field

---

### Functional Requirements Covered

| FR   | Description                                                                 |
| ---- | --------------------------------------------------------------------------- |
| FR12 | Articles without custom prompt behave identically to current behavior       |
| FR13 | Transcriptions without custom prompt behave identically to current behavior |
| FR14 | Existing records return null for custom_prompt field                        |

---

### Completion Checklist

- [ ] Backward compatibility tests written and passing
- [ ] `buildFinalPrompt` edge cases (null, empty, whitespace) tested
- [ ] Full creation flow without `customPrompt` verified for articles
- [ ] Full creation flow without `customPrompt` verified for transcriptions
- [ ] All GET endpoints return `custom_prompt: null` for existing records
- [ ] `pnpm run test` — all tests pass
- [ ] `pnpm run test:e2e` — all tests pass
- [ ] `pnpm run build` — compiles without errors
- [ ] No existing API contracts broken

---

---

## Summary

### Stories Created

| Story Key                                             | Title                               | FRs Covered                                      | Dependencies                   |
| ----------------------------------------------------- | ----------------------------------- | ------------------------------------------------ | ------------------------------ |
| `1-1-database-migrations-custom-prompt`               | Database Migrations                 | FR4, FR9, FR14                                   | None                           |
| `1-2-article-custom-prompt-creation-processing`       | Article Creation + Processing       | FR1, FR2, FR3, FR4, FR12, FR15, FR16, FR17, FR18 | Story 1-1                      |
| `1-3-transcription-custom-prompt-creation-processing` | Transcription Creation + Processing | FR7, FR8, FR9, FR13, FR15, FR16, FR17, FR18      | Story 1-1, Story 1-2 (utility) |
| `1-4-get-endpoints-custom-prompt-response`            | GET Endpoint Response Updates       | FR5, FR6, FR10, FR11, FR14                       | Story 1-1                      |
| `1-5-backward-compatibility-verification`             | Backward Compatibility Verification | FR12, FR13, FR14                                 | Stories 1-1 through 1-4        |

### Implementation Order

```
Story 1-1 (migrations)
    ↓
Story 1-2 (article creation + processing + shared utility)
    ↓
Story 1-3 (transcription creation + processing, reuses utility)
    ↓ (can run in parallel with 1-3)
Story 1-4 (GET response updates)
    ↓
Story 1-5 (backward compatibility verification — integration gate)
```

### Sources Used

| Document                                    | Used For                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `PRD-Meridiano - Custom Summary Prompts.md` | All FRs, acceptance criteria, data flow, prompt concatenation logic, risk mitigation   |
| `ARCHITECTURE.md`                           | Queue consumers, processor file locations, processing flows, module structure          |
| `API_REFERENCE.md`                          | Current endpoint contracts, request/response shapes                                    |
| `DEVELOPER_GUIDE.md`                        | Migration commands, entity patterns, DTO patterns, testing patterns, project structure |
| `LIBRARIES.md`                              | Queue library exports, import conventions                                              |
| `PROJECT_OVERVIEW.md`                       | System context, async processing model                                                 |

### Checklist Validation

- ✅ All 18 FRs from the PRD are covered across the 5 stories
- ✅ Each story has clear acceptance criteria traceable to FRs
- ✅ Dependencies between stories are explicitly stated
- ✅ Technical requirements reference specific files/patterns from project docs
- ✅ Scope boundaries prevent scope creep
- ✅ Testing requirements are concrete, not generic
- ✅ Backward compatibility is verified as a dedicated story
- ✅ Shared utility (`buildFinalPrompt`) is created once (Story 1-2) and reused (Story 1-3)

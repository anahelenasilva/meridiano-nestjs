# Implementation Plan: Briefings Module Remediation

## Overview

Fix 15 issues found in `src/briefings/` review: correctness bugs, dead code, missing test coverage, logging hygiene, one architectural rewrite (`BriefingsService` SQLite→TypeORM), and exposing `customPrompts` through the HTTP endpoint.

## Architecture Decisions

- `BriefingsService` rewrite uses TypeORM `Repository<BriefingEntity>` pattern, matching `ArticlesService`
- `getStats` is deleted (dead code, not exposed); if needed later it belongs in a query class
- `generateSimpleBrief` hardcoded prompt moves into `ConfigService` under a new `simpleBriefing` key
- Module exports trimmed to only `BriefingGenerationService` + `BriefingsService` (only consumers are `AppModule` + script using `app.get()`)

---

## Phase 1: Correctness Fixes

_Safe, isolated, no dependencies between tasks. Can be parallelized._

### Task 1: Fix `getBriefing` returns HTTP 200 for missing resource

**Description:** `BriefingsController.getBriefing` returns `{ error: 'Briefing not found' }` with status 200. Swap for `NotFoundException`. Remove commented-out dead code (lines 15–17).

**Acceptance criteria:**
- [ ] `GET /api/briefings/:id` with unknown ID returns 404
- [ ] No commented-out code in `briefings.controller.ts`

**Verification:**
- [ ] `pnpm test briefings.controller`
- [ ] Manual: `curl -i http://localhost:3000/api/briefings/00000000-0000-0000-0000-000000000000` → 404

**Dependencies:** None

**Files:**
- `src/briefings/briefings.controller.ts`

**Size:** XS

---

### Task 2: Fix `saveBrief` silent empty-string ID

**Description:** `saveBrief` resolves with `''` when `this.lastID` is absent on a successful insert. Should reject instead.

**Acceptance criteria:**
- [ ] If `lastID` is falsy after successful run, promise rejects with descriptive error
- [ ] Callers that catch errors handle `''` case is no longer possible

**Verification:**
- [ ] `pnpm test briefings.service`

**Dependencies:** None

**Files:**
- `src/briefings/briefings.service.ts:48`

**Size:** XS

---

### Task 3: Delete `getStats` dead method

**Description:** `getStats` is never called anywhere and has a multi-resolve race condition. Delete it and its related interfaces (`CountRow`, `AvgRow`) if not used elsewhere.

**Acceptance criteria:**
- [ ] `getStats` method removed from `BriefingsService`
- [ ] `ProcessingStatsResult` export retained if used by other files, else removed
- [ ] `CountRow`, `AvgRow` interfaces removed

**Verification:**
- [ ] `pnpm run build` — no type errors
- [ ] `grep -r 'getStats' src/` — no results

**Dependencies:** None

**Files:**
- `src/briefings/briefings.service.ts`
- `src/briefings/entities/briefing.entity.ts` (if `ProcessingStatsResult` unused)

**Size:** XS

---

### Task 4: Fix `processed_content` null guard

**Description:** `analyzeCluster` maps `article.processed_content` without null guard. Type is `string | null | undefined`. Add `.filter` before `.map`.

**Acceptance criteria:**
- [ ] `clusterSummariesText` never contains `"- null"` or `"- undefined"`
- [ ] Empty cluster after filter returns `null` early (already handled by `length === 0` check)

**Verification:**
- [ ] `pnpm test briefing-generation.service`

**Dependencies:** None

**Files:**
- `src/briefings/services/briefing-generation.service.ts:69–71`

**Size:** XS

---

### Checkpoint: Phase 1
- [ ] `pnpm test` passes
- [ ] `pnpm run build` clean

---

## Phase 2: Architecture

### Task 5: Rewrite `BriefingsService` to TypeORM

**Description:** Replace the entire SQLite-callback API (`db.prepare`, `stmt.run`, `db.all`, `db.get`) with TypeORM `Repository`. Create a `BriefingEntity` with TypeORM decorators. Follow the same pattern as `ArticlesService`.

**Acceptance criteria:**
- [ ] `BriefingEntity` has `@Entity`, `@PrimaryGeneratedColumn('uuid')`, `@Column`, `@CreateDateColumn` decorators
- [ ] `saveBrief`, `getAllBriefsMetadata`, `getBriefById` use `repository.save()` / `repository.find()` / `repository.findOne()`
- [ ] No `DatabaseService.getDbConnection()` calls remain in `BriefingsService`
- [ ] `BriefingsModule` no longer imports `DatabaseModule` (if `DatabaseModule` was only for `BriefingsService`)
- [ ] Migration generated: `pnpm run migration:generate src/database/migrations/CreateBriefingsTable`

**Verification:**
- [ ] `pnpm run migration:run`
- [ ] `pnpm test briefings.service`
- [ ] `pnpm run build` clean
- [ ] `GET /api/briefings` returns results

**Dependencies:** Tasks 2, 3

**Files:**
- `src/briefings/briefings.service.ts`
- `src/briefings/entities/briefing.entity.ts` → split into `briefing.types.ts` + `briefing.entity.ts` (TypeORM entity)
- `src/briefings/briefings.module.ts`
- `src/database/migrations/[timestamp]_CreateBriefingsTable.ts` (generated)

**Size:** M

---

### Task 6: Move `generateSimpleBrief` hardcoded prompt to `ConfigService`

**Description:** `generateSimpleBrief` has a hardcoded prompt template (lines 296–305). Move it to `ConfigService` under key `simpleBriefing`, identical to how `clusterAnalysis` and `briefSynthesis` are handled.

**Acceptance criteria:**
- [ ] `configService.getPrompt('simpleBriefing')` returns the prompt
- [ ] Profile-specific override via `profilesService.getPromptsForProfile` respected
- [ ] No literal prompt string in `BriefingGenerationService`

**Verification:**
- [ ] `pnpm test briefing-generation.service`

**Dependencies:** None

**Files:**
- `src/briefings/services/briefing-generation.service.ts:296–305`
- `src/config/config.service.ts`

**Size:** S

---

### Task 7: Trim `BriefingsModule` exports

**Description:** All 6 use cases are exported but no other module imports them. `runBriefing.ts` uses `app.get()` which resolves from the full DI container regardless. Remove use case exports. Keep `BriefingGenerationService` and `BriefingsService`.

**Acceptance criteria:**
- [ ] `exports` array in `BriefingsModule` contains only `BriefingGenerationService`, `BriefingsService`
- [ ] `pnpm run build` clean (no missing provider errors)
- [ ] Script still works: `pnpm run ts-node src/scripts/runBriefing.ts --feed default --scrape`

**Verification:**
- [ ] `pnpm run build`

**Dependencies:** None

**Files:**
- `src/briefings/briefings.module.ts`

**Size:** XS

---

### Task 8: Rename `briefing.entity.ts` interface file

**Description:** `src/briefings/entities/briefing.entity.ts` contains only interfaces, no TypeORM decorators. After Task 5 extracts the actual entity, rename remaining interfaces file to `briefing.types.ts`.

**Note:** Do this after Task 5 splits the file.

**Acceptance criteria:**
- [ ] No file named `briefing.entity.ts` contains only interfaces (no `@Entity` decorator)
- [ ] All imports updated to point to new filename

**Verification:**
- [ ] `pnpm run build`

**Dependencies:** Task 5

**Files:**
- `src/briefings/entities/briefing.types.ts` (renamed)
- All files importing from `./entities/briefing.entity` (update imports)

**Size:** XS

---

### Checkpoint: Phase 2
- [ ] `pnpm test` passes
- [ ] `pnpm run build` clean
- [ ] Migration runs cleanly against dev DB
- [ ] `GET /api/briefings` and `GET /api/briefings/:id` work end-to-end

---

## Phase 3: Observability

_All tasks independent._

### Task 9: Replace `console.log`/`console.error` with NestJS `Logger`

**Description:** `BriefingGenerationService` has 15+ raw console calls. Replace with `private readonly logger = new Logger(BriefingGenerationService.name)`.

**Acceptance criteria:**
- [ ] No `console.log` or `console.error` in `briefing-generation.service.ts`
- [ ] `logger.log`, `logger.warn`, `logger.error` used appropriately by severity

**Verification:**
- [ ] `grep 'console\.' src/briefings/services/briefing-generation.service.ts` → no results
- [ ] `pnpm test briefing-generation.service`

**Dependencies:** None

**Files:**
- `src/briefings/services/briefing-generation.service.ts`

**Size:** S

---

### Task 10: Make cluster rate-limit sleep configurable

**Description:** `await new Promise(r => setTimeout(r, 1000))` at line 200 adds 1s/cluster unconditionally. Extract to a config value with default 0ms; document why it exists.

**Acceptance criteria:**
- [ ] Delay reads from `ConfigService` (e.g., `clusterAnalysisDelayMs`, default `0`)
- [ ] Comment documents: this is an AI API rate-limit guard

**Verification:**
- [ ] `pnpm run build`

**Dependencies:** None

**Files:**
- `src/briefings/services/briefing-generation.service.ts:200`
- `src/config/config.service.ts`

**Size:** XS

---

### Task 11: Surface cluster error instead of silent fallback

**Description:** `clusterArticles` catch block swallows errors and falls back to all-zeros with no logging. Log a warning.

**Acceptance criteria:**
- [ ] Catch block calls `this.logger.warn(...)` with the error and cluster count context
- [ ] Fallback behavior retained

**Verification:**
- [ ] `pnpm test briefing-generation.service` — mock k-means throwing, assert warn called

**Dependencies:** Task 9 (needs `Logger` in place)

**Files:**
- `src/briefings/services/briefing-generation.service.ts:46–49`

**Size:** XS

---

### Task 12: Remove noise comments from `RunBriefingUseCase`

**Description:** `// Stage 1: Scraping` etc. are obvious from method names. Remove them.

**Acceptance criteria:**
- [ ] No `// Stage N:` comments in `run-briefing.usecase.ts`

**Dependencies:** None

**Files:**
- `src/briefings/usecases/run-briefing.usecase.ts`

**Size:** XS

---

### Checkpoint: Phase 3
- [ ] `pnpm test` passes
- [ ] `pnpm run build` clean

---

## Phase 4: Test Coverage

_Write tests for all untested classes. Tasks can be done in parallel._

### Task 13: Tests for `BriefingsService`

**Description:** Cover `saveBrief` (success, null ID reject), `getAllBriefsMetadata` (with/without feedProfile filter), `getBriefById` (found, not found).

**Acceptance criteria:**
- [ ] `briefings.service.spec.ts` exists
- [ ] All public methods covered including error paths

**Dependencies:** Task 5

**Files:**
- `src/briefings/briefings.service.spec.ts` (new)

**Size:** S

---

### Task 14: Tests for `BriefingsController`

**Description:** Cover `listBriefings` (delegates to query), `getBriefing` (found → 200, not found → 404).

**Acceptance criteria:**
- [ ] `briefings.controller.spec.ts` exists
- [ ] 404 behavior verified

**Dependencies:** Task 1

**Files:**
- `src/briefings/briefings.controller.spec.ts` (new)

**Size:** S

---

### Task 15: Tests for `RunBriefingUseCase`

**Description:** Top-level orchestrator. Test: all stages succeed, individual stage failure propagates, feature flag disabled.

**Acceptance criteria:**
- [ ] `run-briefing.usecase.spec.ts` exists
- [ ] Stage failure case covered

**Dependencies:** None

**Files:**
- `src/briefings/usecases/run-briefing.usecase.spec.ts` (new)

**Size:** M

---

### Task 16: Tests for `GenerateBriefUseCase` and `GenerateSimpleBriefUseCase`

**Description:** Both use cases need: feature flag disabled path, success path, error propagation from service.

**Acceptance criteria:**
- [ ] `generate-brief.usecase.spec.ts` exists
- [ ] `generate-simple-brief.usecase.spec.ts` exists

**Dependencies:** None

**Files:**
- `src/briefings/usecases/generate-brief.usecase.spec.ts` (new)
- `src/briefings/usecases/generate-simple-brief.usecase.spec.ts` (new)

**Size:** S

---

### Task 17: Tests for remaining use cases

**Description:** `ScrapeArticlesUseCase`, `ProcessArticlesUseCase`, `RateArticlesUseCase`, `CategorizeArticlesUseCase` — each needs happy path + error/empty input handling.

**Acceptance criteria:**
- [ ] 4 spec files created, one per use case
- [ ] All cover error path

**Dependencies:** None

**Files:**
- `src/briefings/usecases/scrape-articles.usecase.spec.ts` (new)
- `src/briefings/usecases/process-articles.usecase.spec.ts` (new)
- `src/briefings/usecases/rate-articles.usecase.spec.ts` (new)
- `src/briefings/usecases/categorize-articles.usecase.spec.ts` (new)

**Size:** M

---

### Task 18: Expose `customPrompts` through `POST /api/briefings/generate`

**Description:** `GenerateBriefInputDto` has no `customPrompts` field. `GenerateBriefUseCase` never forwards options to `generateBrief`. Add the field to the DTO, forward it through the use case, and expose it on the controller.

**Acceptance criteria:**
- [ ] `GenerateBriefInputDto` has optional `customPrompts?: { clusterAnalysis?: string; briefSynthesis?: string }`
- [ ] `GenerateBriefUseCase.execute` passes `{ customPrompts: input.customPrompts }` as second arg to `generateBrief`
- [ ] Controller endpoint accepts and passes the body
- [ ] `customPrompts` fields validated with `@IsOptional()`, `@IsString()`

**Verification:**
- [ ] `pnpm test generate-brief.usecase`
- [ ] Manual: POST with `customPrompts.briefSynthesis` overrides default prompt

**Dependencies:** Task 16 (tests already cover the use case; update them to include `customPrompts` path)

**Files:**
- `src/briefings/usecases/dto/generate-brief.dto.ts`
- `src/briefings/usecases/generate-brief.usecase.ts`
- `src/briefings/briefings.controller.ts`

**Size:** S

---

### Checkpoint: Phase 4 — Done
- [ ] `pnpm test` passes — full suite
- [ ] Coverage includes all public methods, error cases

---

## Risks

| Risk                                                                                           | Impact | Mitigation                                        |
| ---------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------- |
| TypeORM entity conflicts with existing `briefings` table schema                                | High   | Generate migration, inspect diff before running   |
| `DatabaseService` used by other modules — removing it from `BriefingsModule` may break imports | Med    | Grep all `DatabaseModule` imports before removing |
| `briefing.entity.ts` rename breaks external import paths                                       | Med    | `grep -r briefing.entity src/` before rename      |

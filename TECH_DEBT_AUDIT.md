# Tech Debt Audit — meridiano-nestjs
Generated: 2026-04-26

---

## Executive Summary

1. **63 npm vulnerabilities** (3 critical, 29 high) including `axios` (direct prod dep) with SSRF + DoS CVEs, TypeORM with SQL injection, and Handlebars with JS injection.
2. **DNS rebinding SSRF bypass** in the public-facing `/api/articles/external` endpoint — the IP blocklist is bypassed by any domain that resolves to a private IP.
3. **AiService bypasses ConfigService** and reads API keys directly from `process.env`, inconsistent with every other service.
4. **TypeScript type errors in test files** — test mocks are out of sync with real interfaces; `tsc --noEmit` fails.
5. **1000ms `setTimeout` sleeps in serial processing loops** — processing 1000 articles adds 16+ minutes of dead time.
6. **SQLite-compatibility adapter over PostgreSQL** — a custom runtime `?`→`$N` converter replaces all `?` characters, including those that may appear inside string literals.
7. **Unstructured logging** — hot paths (youtube-transcriptions: 55 calls, processor: 32 calls) use `console.log` with plain strings, making production diagnosis hard.
8. **TypeORM declared as a dependency but only used for migrations** — zero `@Entity`/`TypeOrmModule.forFeature()` usage; all data access goes through a raw SQL adapter.
9. **`moment.js` (69KB) for trivial date arithmetic** replaceable with native `Date`.
10. **Dead config field `databaseFile: 'meridian.db'`** is a SQLite migration artifact with zero callers.

---

## Architectural Mental Model

Meridiano is a content intelligence pipeline: RSS feeds and YouTube channels are scraped → articles/transcripts are summarized and embedded by AI → K-means clustering groups related content → a synthesized briefing is generated. All heavy work is async via BullMQ queues backed by Redis.

The persistence layer is unusual: there is **no TypeORM entity usage in application code**. Instead, a custom `DatabaseService` wraps `pg.Pool` behind a SQLite-compatible interface (`db.prepare`, `stmt.run`, `stmt.finalize`, `db.all`, `db.get`). TypeORM is installed and used only to run migrations via CLI. This is coherent but the `?`→`$N` conversion at runtime and the `any[]` parameter types erase all type safety at the DB boundary.

Domain modules (`articles`, `briefings`, `youtube-transcriptions`, etc.) live in `src/`; shared infra lives in `libs/` — this separation is mostly respected. The CQRS-adjacent pattern (queries/commands/usecases subdirs) is applied consistently in newer modules but absent in older ones (`scraper`, `bookmarks`, `users`).

The architecture is simpler than the README implies — no real CQRS bus, just conventionally named classes with `execute()` methods.

---

## Findings

| ID | Category | File:Line | Severity | Effort | Description | Recommendation |
|----|----------|-----------|----------|--------|-------------|----------------|
| F001 | Security | `package.json` (axios 1.7.7) | Critical | S | `axios` direct prod dep has two CVEs: SSRF via URL bypass and prototype-pollution DoS | `pnpm update axios` to ≥ 1.8.4 |
| F002 | Security | `external-articles.controller.ts:275-321` | High | M | SSRF blocklist only checks raw IP strings. Hostname `attacker.com` resolving to `192.168.1.1` passes `isBlockedIpAddress` because `isIP('attacker.com') === 0`. Actual HTTP request fires after DNS resolution. | Resolve hostname to IP before the check, or use a DNS-aware SSRF protection library (e.g. `ssrf-req-filter`) |
| F003 | Security | `postgres-database.service.ts:14-18` | High | M | `convertPlaceholders` replaces every `?` character, including `?` inside SQL string literals (e.g. `WHERE meta LIKE '%?%'`). This mutates query structure and could corrupt queries. | Switch to parameterized queries using `$N` notation directly, eliminating the runtime replacement |
| F004 | Security | `package.json` (TypeORM 0.3.20) | High | S | TypeORM has a known SQL injection via crafted column/table names. CVE is in the vulnerable version range. | `pnpm update typeorm` |
| F005 | Type safety | `ai.service.spec.ts:249` | High | S | Mock object missing `openaiTtsVoice` and `groqTtsVoice` properties. `tsc --noEmit` fails with TS2345. This means the type check CI gate is broken for this module. | Add missing fields to the mock fixture |
| F006 | Type safety | `briefing-generation.service.spec.ts:156-157` | High | S | `null` assigned to `string \| undefined` — fails `tsc --noEmit` with TS2322 | Replace `null` with `undefined` in fixture |
| F007 | Consistency | `ai.service.ts:23-27` | High | S | `AiService` reads `process.env.DEEPSEEK_API_KEY`, `EMBEDDING_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY` directly, bypassing `ConfigService`. Every other service uses `ConfigService`. Makes mocking impossible without env manipulation in tests. | Move key reads into `ConfigService` and inject via constructor |
| F008 | Performance | `processor.service.ts:156,298,422` | High | M | Three processing loops each sleep `1000ms` per article (`setTimeout`). Processing 500 articles through all three stages = 25 minutes of pure sleep. | Remove unconditional sleeps; add optional rate-limit delay only when provider returns 429 |
| F009 | Performance | `ai.service.ts:128,173` | Medium | S | On every failed API call (DeepSeek, OpenAI), service sleeps 1000ms before returning `null`. These are in hot paths called per article. | Move retry delay inside the retry loop, not the catch-return-null path |
| F010 | Architecture | `libs/database/postgres-database.service.ts:28,65,83,117` | Medium | M | All DB layer parameters typed `any[]`. No type safety on query input. A caller passing `[userId, articleId]` has no contract guarantee; refactors silently break. | Type parameters as `(string \| number \| boolean \| null \| undefined \| string[])[]` at minimum |
| F011 | Architecture | `libs/database/database.service.ts:11-13` | Medium | M | `DatabaseService` hardcodes `new PostgresDatabaseService()` inside its constructor. This makes it impossible to inject a test double for the DB layer without module-level hackery. The `AbstractDatabaseService` exists for polymorphism but is never used for it. | Let NestJS DI inject the implementation, or expose a static factory |
| F012 | Consistency | `src/ai/ai.service.ts`, `src/audio-files/usecases/generate-audio.usecase.ts`, `src/articles/articles.controller.ts`, `libs/email/email.module.ts`, `libs/redis/redis.service.ts` | Medium | M | 14+ files read `process.env.*` directly. ConfigService exists as the single source of truth but is not used consistently. Breaks test isolation and makes env contract implicit. | Route all env reads through ConfigService |
| F013 | Consistency | `src/youtube-transcriptions/services/youtube-transcriptions.service.ts:55+` | Medium | M | 55 `console.log/error` calls in a single service file. Hot path for channel processing. Structured Logger is available (NestJS). No correlation IDs, no JSON, not queryable in production. | Replace with NestJS `Logger`; add `videoId`/`channelId` context fields |
| F014 | Consistency | `src/processor/processor.service.ts:32+` | Medium | M | 32 `console.log` calls in processor. Mix of Logger (for embedding failures) and console elsewhere. | Standardize to NestJS `Logger` with context |
| F015 | Architectural decay | `src/config/config.entity.ts`, `src/config/config.service.ts:71` | Medium | S | `app.databaseFile: 'meridian.db'` is a SQLite artifact. The field is declared in `Config` interface and assigned but has zero callers. Dead configuration creating false impression the app can still use SQLite. | Delete `databaseFile` from the `app` config block and `Config` type |
| F016 | Type safety | `libs/database/postgres-database.service.ts:66,84` | Medium | S | `callback?: (err: Error \| null, rows?: any[]) => void` — rows are typed `any[]` throughout the DB layer. All callers cast with inline interfaces (`ArticleRow`, `BookmarkRow`, etc.) but the compiler can't verify correctness. | Type the callback generically: `callback?: (err: Error \| null, rows?: T[]) => void` |
| F017 | Security | `libs/database/postgres-database.service.ts:177` | Medium | S | Logs full DB connection details: host, port, dbname, username at INFO level on startup. Leaks connection metadata to log aggregators. | Remove or redact the detailed line at 177; keep only "Connecting to PostgreSQL..." |
| F018 | Performance | `articles.service.ts` (all methods) | Medium | L | Every method calls `this.databaseService.getDbConnection()` which creates a new `PostgresConnection` wrapper object. While the wrapper is lightweight, this pattern allocates a new object on every DB call (56 unique call sites). The pool is reused, but the pattern discourages future batching. | Cache the connection wrapper per-request or use the pool directly |
| F019 | Dependencies | `package.json` (moment 2.30.1) | Low | S | `moment` is used in 3 files (`list-articles.query.ts:4`, `list-youtube-transcriptions.query.ts:4`, `parse-relative-time.ts:4`) for simple date subtraction. Moment is deprecated upstream and 69KB gzipped. | Replace 3 usages with `new Date()` arithmetic or `date-fns` (already a common pattern in the codebase) |
| F020 | Architecture | `external-articles.controller.ts:57`, `youtube-transcriptions.service.ts:57` | Low | M | `forwardRef(() => QueueService)` in two domain modules signals a circular dependency. `forwardRef` suppresses the error but doesn't fix the cycle. Circular deps cause subtle initialization ordering bugs. | Extract the queue-related call site into a dedicated facade or event emitter to break the cycle |
| F021 | Consistency | `articles.service.ts`, `bookmarks.service.ts`, `youtube-channels.service.ts`, `users.service.ts` | Low | M | These services use Promise-wrapping of callback-based DB calls. The pattern repeats identically across 774, 269, and 150 lines. Each method is a boilerplate `new Promise((resolve, reject) => { const db = ...; db.all(..., (err, rows) => { if (err) reject; else resolve; }) })`. | Extract a `queryAll<T>`, `queryOne<T>`, `execute` helper to reduce 400+ lines of boilerplate |
| F022 | Consistency | `src/briefings/`, `src/youtube-transcriptions/`, `src/audio-files/` vs `src/bookmarks/`, `src/scraper/`, `src/users/` | Low | L | Newer modules have `queries/`, `commands/`, `usecases/` subdirs; older ones (bookmarks, scraper, users) put everything in the module root. The repo has no convention enforcement (no eslint-plugin-project-structure rule that applies). | Add structure rules to enforce consistent layout, or document that older modules don't need migration |
| F023 | Test debt | `src/scraper/scraper.service.ts` (341 lines) | Low | M | No spec file. This is one of the highest-churn files in the last 6 months and the entry point for all external content ingestion. | Add unit tests for `scrapeSingleArticle`, feed parsing, image extraction |
| F024 | Test debt | `src/bookmarks/bookmarks.service.ts` (269 lines) | Low | M | No spec file. Core user feature. | Add unit tests covering duplicate bookmark handling |
| F025 | Type safety | `src/youtube-transcriptions/services/youtube-transcriptions-innertube.service.ts:5` | Low | S | File has `any` type usage in 5 places — type-safe parsing of YouTube API responses is available | Type the segment response object |
| F026 | Dependencies | `package.json` (form-data 4.0.1) | Low | S | Listed as direct prod dep. `form-data` 4.0.1 is in the range affected by the unsafe random CVE. Check if it's actually used in production code (may be a transitive issue). | `pnpm audit --fix` or pin to patched version |
| F027 | Architecture | `src/config/config.service.ts` (415 lines) | Low | M | ConfigService imports `YoutubeChannelsService`, creating a dependency from infra-config into a domain module. This inversion means config can't be loaded without YouTube channels DB access. | Move the channel config fetching to a separate service or lazy-load it |
| F028 | Observability | `src/ai/ai.service.ts:61,79-80,86` | Low | S | Client initialization success is logged to `console.log` not `Logger`. Missing structured init events (which provider, which model). | Use Logger, include provider/model metadata |

---

## Top 5: Fix These First

### 1. F001 + F004 — Update axios and TypeORM (CVEs in direct deps)

`axios` at `1.7.7` is a direct production dep with active SSRF and DoS CVEs that affect the scraper. `typeorm` at `0.3.20` has a SQL injection CVE.

```bash
pnpm update axios typeorm
```

Check for breaking changes in axios 1.8.x (interceptor behavior) and TypeORM 0.3.21+. Run the test suite. This is 30 minutes of work.

---

### 2. F002 — DNS rebinding SSRF in /api/articles/external

`assertSafeExternalUrl` checks if the hostname string is a private IP range. It does not resolve DNS. An attacker controls `evil.com` → DNS returns `192.168.1.1` → the blocklist check passes → axios fetches the internal host.

**Fix sketch:**

```typescript
// In assertSafeExternalUrl, after parsing URL:
const { address } = await dns.promises.lookup(parsedUrl.hostname);
if (this.isBlockedIpAddress(address)) {
  throw this.createInvalidUrlException();
}
```

Or use a library like `ssrf-req-filter` that intercepts axios requests and validates the resolved IP. The DNS lookup adds latency (~5ms for cached, ~100ms for cold), but this is a one-time check per submission.

---

### 3. F005 + F006 — Fix TypeScript errors so `tsc --noEmit` passes

Currently `tsc --noEmit` exits with 3 errors. This means the type check CI step (if it exists) is either broken or skipped. Any new type errors added go undetected.

`src/ai/ai.service.spec.ts:249` — Add `openaiTtsVoice: 'alloy', groqTtsVoice: 'hannah'` to the mock fixture.

`src/briefings/services/briefing-generation.service.spec.ts:156-157` — Change `null` to `undefined` on both lines.

These are two-line fixes.

---

### 4. F008 — Remove unconditional 1-second sleeps from processing loops

`processor.service.ts` calls `await new Promise(r => setTimeout(r, 1000))` at the end of every iteration in three loops (process, rate, categorize). On a 200-article batch this adds 10 minutes of sleep time. The comment implies it's rate-limit protection, but it fires even on success.

**Fix sketch:**

```typescript
// Replace unconditional sleep with provider-signaled backoff:
// Remove the sleep entirely from the main path.
// In ai.service.ts callDeepseekChat catch block, only sleep on 429:
if (errorMessage.includes('429') || errorMessage.includes('rate')) {
  await sleep(1000);
}
```

The sleep in the batch embedding fallback loop (`ai.service.ts:339`) is legitimate rate-limit mitigation — leave that one.

---

### 5. F003 — Audit `convertPlaceholders` for `?` in string literals

The runtime `?`→`$N` replacement in `postgres-database.service.ts:13-18` is a footgun. Test it:

```sql
-- This query would break:
WHERE categories LIKE '%?%'
-- Would become:
WHERE categories LIKE '%$1%'  -- breaks the LIKE pattern
```

Check `articles.service.ts:508`: `query += ' AND categories LIKE ?'` with param `%"${category}"%`. This is safe because the `?` is in SQL position, not inside a string literal. But `articles.service.ts:492-495`: the LIKE pattern is built as a param, not inline — also safe.

The risk is latent: any developer who writes `WHERE title LIKE '%?%'` (putting the wildcard in the SQL) rather than passing `%value%` as a param will silently corrupt the query. Add a unit test that catches this and a code comment on `convertPlaceholders` warning against `?` in string literals.

---

## Quick Wins

- [ ] **F015**: Delete `databaseFile: 'meridian.db'` from `config.entity.ts` and `config.service.ts` — 2 lines
- [ ] **F005**: Fix `ai.service.spec.ts:249` — add 2 missing mock fields
- [ ] **F006**: Fix `briefing-generation.service.spec.ts:156-157` — change `null` → `undefined`
- [ ] **F017**: Remove/redact DB credentials from log line `postgres-database.service.ts:177`
- [ ] **F001**: `pnpm update axios` — bump to ≥ 1.8.4 (SSRF + DoS CVEs)
- [ ] **F004**: `pnpm update typeorm` — SQL injection CVE
- [ ] **F019**: Replace `moment` in 3 files with native `Date` arithmetic — removes 69KB dep and a deprecated library
- [ ] **F028**: Replace 4 `console.log` init messages in `ai.service.ts` with NestJS `Logger`

---

## Things That Look Bad But Are Actually Fine

**The SQLite-compatible DB adapter is intentional architecture, not debt.** The codebase migrated from SQLite to PostgreSQL and preserved the callback-based interface. The adapter (`PostgresConnection`) is a deliberate compatibility shim that lets all existing service code keep working. It's unusual but it functions correctly for the use case. The actual debt is the `any[]` typing (F010) and the `?` conversion footgun (F003), not the pattern itself.

**56 calls to `getDbConnection()` are not connection leaks.** Each call creates a cheap JS wrapper object around the shared pool; no new DB connections are opened. The pool is properly bounded (`max: 20`) and cleaned up via `onModuleDestroy`.

**`forwardRef` on `QueueService` is a code smell but not a correctness bug.** NestJS handles the circular ref correctly at runtime. The debt is that it obscures the dependency graph, not that it causes failures.

**`processor.service.ts` serial processing (not concurrent) is intentional.** The 1000ms sleep is misguided, but the serial loop itself makes sense for rate limiting AI API calls. Processing articles concurrently would risk 429 errors. Remove the sleep (F008) but keep the serial pattern.

**K-means clustering on embeddings without validation is fine at this scale.** `ml-kmeans` is called with `effectiveClusters = min(k, floor(n/2))`. The guard prevents k > n/2. For a personal intelligence briefing system with <200 articles per run, this is adequate.

**`JSDOM` in the scraper is not an XSS risk.** The scraped HTML is parsed server-side to extract text content via `Readability`; it's never rendered in a browser. `JSDOM` executing scripts would be a risk if `runScripts` was enabled, but it's not set here.

---

## Open Questions for the Maintainer

1. **Is `configService.formatPrompt` SQL-injection-safe?** It does string interpolation for AI prompt templates (`article_content`, `article_title`). If article content contains `{variable_name}` style strings, could it collide with template variables? Worth auditing `buildFinalPrompt` in `shared/helpers/build-final-prompt.ts`.

2. **Is `TypeOrmModule` registered anywhere?** No `TypeOrmModule.forRoot()` was found in `app.module.ts` or any module file. If true, TypeORM migrations work via CLI (which uses `typeorm.config.ts` directly) but TypeORM is otherwise an unused 10MB dep. Intentional?

3. **What is `meridian.db` in the repo root?** A 31-KB file at the repo root appears to be a SQLite database (not gitignored until recently). Does it contain real data? Should it be in `.gitignore`?

4. **The `app.module.ts` import of `DatabaseModule`** — is `initDb()` called before the first request handler fires, or is there a possible race condition on startup? The `PostgresDatabaseService.initDb()` is async and the module is bootstrapped without awaiting it explicitly.

5. **Are there other callers of `ScraperService.fetchArticleContentAndOgImage` that bypass the SSRF check?** The external articles endpoint checks URLs before scraping. But the RSS feed scraper calls axios on feed-provided URLs without the same check. Is that intentional (trusted feeds) or an oversight?

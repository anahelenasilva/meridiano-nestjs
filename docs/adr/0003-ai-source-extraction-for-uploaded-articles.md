# ADR-0003: AI-Based Article Source Extraction for Uploaded Markdown Articles

## Status
Accepted

## Context
When a markdown article is uploaded, `feed_source` was hardcoded to `'S3 Upload'`. RSS articles carry a meaningful source name (e.g. `"Will Larson"`, `"TechCrunch"`) from the feed config. Uploaded articles lacked equivalent attribution, making them opaque in listings and briefings.

Uploaded markdown files often contain the author or publication in the body — patterns like `**Author:** João Silva` or `By João Silva` — but the format varies and is not guaranteed.

## Decision
Before saving an uploaded article to the database, run a dedicated AI call to extract the Article Source from the markdown content. If extraction succeeds, use the result as `feed_source`. If the AI cannot identify a source, fall back to `'Unknown'`.

This extraction is scoped to the markdown upload path only, via `ArticleIngestionService.resolveSource` (branching on `ArticleSource.type === 'markdown'`). RSS ingestion resolves the source from the feed name, and manual scrape ingestion uses a fixed `'Manual'` value — neither AI call path is affected. `ArticleIngestionService` now owns source resolution for all ingestion paths (RSS, manual, markdown), replacing the earlier per-processor scoping to `MarkdownArticleProcessor`.

## Alternatives considered

**Regex extraction in `parseMarkdownArticle`**
Deterministic and free. Rejected because the format of author/byline fields varies enough across real uploaded documents that a regex approach would need continual maintenance and would still miss edge cases.

**Piggyback on the existing summary prompt (b1)**
One fewer AI call. Rejected because the summary prompt is already complex, profile-specific, and structured with strict output sections. Adding a second extraction job risks breaking response parsing and makes the prompt harder to reason about.

**Use `'S3 Upload'` as fallback**
Consistent with historical data. Rejected because it conflates "no author found" with "feature didn't exist yet", making it impossible to distinguish old records from new ones where extraction failed.

## Consequences
- Uploaded articles gain meaningful Article Source attribution when present in the content.
- `'Unknown'` is a new sentinel value for `feed_source`. Legacy records with `'S3 Upload'` remain unchanged and queryable as pre-feature uploads.
- One extra AI call per markdown upload (small cost, upload path is low-frequency).
- No schema migration required — `feed_source` is already a free-text `NOT NULL` column.

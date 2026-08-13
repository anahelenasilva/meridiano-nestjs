# ADR-0004: Daily Digest Does Not Use the Briefing Pipeline

## Status
Accepted. Amended by issue #190 (2026-08): the digest is now save-only — email delivery was removed. The decision to bypass the Briefing pipeline stands; the notes below reflect the save-only behavior.

## Context
The Daily Digest is a scheduled feature that selects the top 10 TECHNOLOGY articles from the previous day and persists them to the `digests` table each morning, read back via `GET /api/news-digest/latest`. The existing Briefing pipeline (scrape → process → rate → cluster → synthesise → store Briefing) was a candidate for reuse: run it automatically on a cron and store the resulting Briefing.

## Decision
The Daily Digest bypasses the Briefing pipeline entirely. It queries the DB directly for yesterday's TECHNOLOGY articles ranked by `impact_rating`, passes the pool to an AI selection step with a personal relevance prompt, and saves the selected items to the `digests` table. No Briefing entity is created. (Originally the digest also emailed the selection; issue #190 removed the email step, leaving a save-only pipeline.)

## Alternatives considered

**Auto-generate a Standard Briefing and store it**
Reuses all existing pipeline stages. Rejected because: (1) the pipeline scrapes fresh articles rather than filtering yesterday's DB records — running it on a schedule would duplicate and conflict with the regular ingestion flow; (2) the digest format (title + feed source + URL) needs no AI narrative synthesis or article clustering; (3) coupling the digest to the Briefing entity mixes two distinct concerns.

## Consequences
- Daily Digest is a self-contained module with no dependency on `BriefingsModule`.
- `processed_content` (Article Summary) is not used in the digest — only `title`, `feed_source`, and `url`.
- Changes to the Briefing pipeline do not affect the digest, and vice versa.
- If a richer digest format is wanted later (AI narrative, clustering), the pipeline can be introduced without migrating existing digest logic.

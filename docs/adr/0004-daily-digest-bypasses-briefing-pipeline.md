# ADR-0004: Daily Digest Does Not Use the Briefing Pipeline

## Status
Accepted

## Context
The Daily Digest is a scheduled email feature that selects the top 10 TECHNOLOGY articles from the previous day and delivers them to the owner each morning. The existing Briefing pipeline (scrape → process → rate → cluster → synthesise → store Briefing) was a candidate for reuse: run it automatically on a cron and email the resulting Briefing.

## Decision
The Daily Digest bypasses the Briefing pipeline entirely. It queries the DB directly for yesterday's TECHNOLOGY articles ranked by `impact_rating`, passes the pool to an AI selection step with a personal relevance prompt, and sends a plain-text email. No Briefing entity is created.

## Alternatives considered

**Auto-generate a Standard Briefing and email it**
Reuses all existing pipeline stages. Rejected because: (1) the pipeline scrapes fresh articles rather than filtering yesterday's DB records — running it on a schedule would duplicate and conflict with the regular ingestion flow; (2) the email format (title + feed source + URL) needs no AI narrative synthesis or article clustering; (3) coupling email delivery to the Briefing entity exposes the digest in the app UI, mixing two distinct delivery channels.

## Consequences
- Daily Digest is a self-contained module with no dependency on `BriefingsModule`.
- `processed_content` (Article Summary) is not used in the digest email — only `title`, `feed_source`, and `url`.
- Changes to the Briefing pipeline do not affect digest delivery, and vice versa.
- If a richer digest format is wanted later (AI narrative, clustering), the pipeline can be introduced without migrating existing digest logic.

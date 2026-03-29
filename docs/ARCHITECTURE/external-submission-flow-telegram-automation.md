# External submission flow (Telegram / automation)

External clients (for example Node-RED in front of Telegram) POST to `/api/articles/external` when `TELEGRAM_INTEGRATION_ENABLED` is true.

1. Optional metadata (`chatId`, `messageId`, `username`, note) is stored via `TelegramSubmissionService` in `telegram_submissions` (status transitions: pending, success, failed, duplicate).
2. `ScraperService` ingests the URL; on success the article is queued for processing.
3. Submission rows are updated with the resulting `articleId` or failure/duplicate information. If persisting the submission row fails, ingestion can still proceed (degraded tracking).

The same endpoint uses `X-External-Token` (`EXTERNAL_API_TOKENS`) plus Redis-backed rate limiting (per-token or per-IP key).

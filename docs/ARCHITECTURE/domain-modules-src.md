# Domain Modules (`src/`)

| Module | Responsibility |
|---|---|
| `articles` | Article CRUD/list/detail, external ingestion endpoint, markdown upload flow, article audio enqueue, Telegram-oriented submission tracking (`TelegramSubmissionService` + `telegram_submissions`) |
| `scraper` | URL/RSS scraping and article ingestion |
| `processor` | Article enrichment pipeline (summarize, embedding, rate, categorize) |
| `briefings` | Briefing persistence (`BriefingsService`), generation (`BriefingGenerationService`), listing/detail API, and briefing-oriented use cases |
| `youtube-transcriptions` | Transcript ingestion, summary flow, transcription audio enqueue |
| `youtube-channels` | Manage YouTube channel configuration |
| `audio-files` | Generate/store audio metadata and S3 references |
| `users` | User creation/read |
| `bookmarks` | User-to-article bookmarking |
| `profiles` | Feed profile access |
| `auth` | Auth API composition around `@libs/auth` |

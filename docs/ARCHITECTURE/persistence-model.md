# Persistence Model

The system uses PostgreSQL migrations in `src/database/migrations`.

Key tables present in migrations:

- `articles`
- `briefings`
- `youtube_transcriptions`
- `youtube_channels`
- `users`
- `bookmarks`
- `audio_files`
- `telegram_submissions`
- `typeorm_migrations`

Notable schema traits:

- UUID primary keys are in place for core tables.
- `briefings.article_ids` is stored as serialized IDs (no `briefing_articles` join table in current migrations).
- `audio_files` enforces uniqueness by `(source_type, source_id)`.

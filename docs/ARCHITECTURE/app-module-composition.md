# App Module Composition

`src/app.module.ts` composes the application from:

- `ConfigModule`, `DatabaseModule`, `AuthModule`, `AiModule`
- `ArticlesModule`, `AudioFilesModule`, `BriefingsModule`
- `ProfilesModule`, `ScraperModule`, `ProcessorModule`
- `YoutubeChannelsModule`, `YoutubeTranscriptionsModule`
- `QueueModule`, `UsersModule`, `BookmarksModule`, `S3Module`

Security baseline:

- Global JWT guard via `APP_GUARD` (`JwtAuthGuard`)
- Public endpoints explicitly marked with `@Public()`

# Runtime Layers

| Layer | Main Components |
|---|---|
| API | NestJS controllers in `src/**/*.controller.ts` (including root-level controllers like `src/app.controller.ts`) |
| Domain/Application | Services, commands, queries, and use cases in `src/` modules |
| Async Processing | BullMQ queues in `libs/queue` and workers in `libs/queue/processors`, `src/articles/processors`, `src/youtube-transcriptions/processors` |
| Infrastructure | `libs/database`, `libs/redis`, `libs/queue`, `libs/s3`, `libs/email`, `libs/auth`, `libs/audio` |
| External Services | PostgreSQL, Redis, AWS S3, DeepSeek, OpenAI, Together, Groq, Mailgun |

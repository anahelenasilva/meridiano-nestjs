# System View

Meridiano is a modular NestJS backend that ingests content (RSS, manual URLs, YouTube), enriches it with AI, and exposes results through authenticated APIs.

At a high level:

1. HTTP controllers receive requests primarily under `/api/*`, with additional root/platform routes (for example `/`).
2. Services and use cases orchestrate domain behavior.
3. Async workloads are pushed to BullMQ queues.
4. Workers process jobs and persist results in PostgreSQL.
5. Files (markdown/audio) are stored in S3, with Redis used for queues and rate limiting.

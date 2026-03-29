# Infrastructure Libraries (`libs/`)

| Library | Responsibility |
|---|---|
| `auth` | JWT auth services/guards/decorators + Redis-backed rate limit utilities |
| `database` | PostgreSQL + TypeORM bootstrapping and migration runner |
| `queue` | Queue definitions, queue service, queue workers |
| `redis` | Shared Redis client |
| `s3` | S3 operations (including presigned upload flow) |
| `email` | Provider-based email sending (`EmailModule.forRoot()`) |
| `audio` | Audio job enqueue/status orchestration (`AudioJobService`) |

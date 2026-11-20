# Article processing

A user submits a URL; the API scrapes it, stores the article, and queues a processing job that runs the pipeline (summary, rating, embedding, optional audio). The job state is readable while it runs, and the processed article appears in the article views.

## Sub-features

- `article-submit` scrapes a URL and returns a job (`POST /api/articles`).
- `article-duplicate` rejects a URL already stored with a 400.
- `article-job-status` reports the job state (`GET /api/articles/jobs/:jobId`).
- `article-processed` shows the processed fields on `GET /api/articles/:id` once the job completes.
- `article-delete` removes the article (`DELETE /api/articles/:id`).

## How to get to it (user POV)

- Frontend: the add-article form.
- CLI: article submission with `x-api-key` (`AUTH=apikey`).

## Driving it with api.sh

Preconditions:

- Baseline from the README.
- A public article URL `U` that is not stored yet: `$S/sql.sh url-absent "select count(*) from articles where url = '<U>'"` prints 0.
- Ana agreed to the AI spend for this run.

- **Submit.** `EXPECT=201 $S/api.sh article-submit POST /api/articles '{"url":"<U>","feedProfile":"technology"}' | jq -c .`. Response has `jobId` and the article id (`articleFileKey`).
- **Duplicate.** Repeat the same request with `EXPECT=400`. Message `Article already exists in database`.
- **Job status.** Poll `EXPECT=200 $S/api.sh article-job GET /api/articles/jobs/<jobId>` until the state is `completed` or `failed`. Wait on the state, not a fixed sleep.
- **Processed.** `EXPECT=200 $S/api.sh article-processed GET /api/articles/<id>` shows the summary fields filled, and `$S/sql.sh article-row "select id, processed_at is not null as processed from articles where id = '<id>'"` agrees.
- **Delete.** `EXPECT=200 $S/api.sh article-delete DELETE /api/articles/<id>`, then `GET /api/articles/<id>` returns 404.

## Gotchas

- The job runs on the verify instance's worker (Redis db 9), not Ana's dev server, so `server.log` in the evidence dir holds the pipeline's logs.
- Articles are global: until deleted, the test article shows up in Ana's frontend. Delete it in the same journey.
- Column names in the `sql.sh` queries (`url`, `processed_at`) were not checked yet; run `\d articles` through `sql.sh` on the first run and update this file.
- Not driven yet. The first run settles the response field names above.

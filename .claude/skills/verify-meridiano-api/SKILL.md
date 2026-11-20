---
name: verify-meridiano-api
description: Use when proving a meridiano-nestjs API change against the real running app, before a PR or when an issue's "done when" needs proof beyond unit and e2e specs. Boots the API on its own port, calls routes as a dedicated verify user, and keeps request, response and DB evidence.
---

# Verify the Meridiano API

The user-facing surface is the HTTP API under `/api` (the frontend and the CLI both call it). This skill boots one extra API instance from a checkout, drives it with curl through `scripts/api.sh`, and proves behavior with recorded responses plus read-only DB queries. The e2e specs in `test/` mock services below the controller; this skill exercises the real path down to Postgres, Redis and the AI providers.

All helpers live in `.claude/skills/verify-meridiano-api/scripts/` (called `$S` below). Bash state does not persist between tool calls, so prefix every helper call with the `VERIFY_RUN=...` line `launch.sh` printed.

## Shared state, read before launching

The instance shares Ana's local data, so treat it as a guest:

- **Postgres** is the dev DB (`meridiano-postgres-local`, port 5435, database `meridian`). Writes are real. Journeys act as `verify@meridiano.local`, never as Ana's account, and undo their writes through the API.
- **Redis** is Homebrew Redis on 127.0.0.1:6379. The instance uses db 9 (`REDIS_URL=redis://127.0.0.1:6379/9`), so its queues, workers and rate-limit counters never touch Ana's db 0. One verify instance at a time: `launch.sh` refuses a second.
- **Migrations run on boot.** `launch.sh` refuses when the checkout has migration files the dev DB lacks. Ask Ana before rerunning with `VERIFY_ALLOW_MIGRATIONS=1`, since that changes her dev schema.
- **AI calls cost money.** Ask, briefing generation and article processing call real providers. Run them only when the change touches them.

## Launch

1. Once per machine: `$S/ensure-user.sh`. It upserts the verify user and keeps its password in `~/.config/meridiano-verify/user.env`. Rerunning is safe.
2. Check `docker ps` lists `meridiano-postgres-local` as healthy and `redis-cli ping` prints `PONG`. If not, `pnpm docker:up` starts Postgres; Redis is `brew services start redis`. Starting either is Ana's call when they were stopped on purpose, so ask.
3. `$S/launch.sh [checkout]` (default: current git toplevel; a worktree needs `.env` linked from the main checkout). It runs `npx nest start` on a free port in its own process group and returns once the log shows `Meridiano API server running` and `GET /api/health` answers 200. The build takes about 10 to 60 s. Done when it prints `VERIFY_RUN=<dir>`.
4. `VERIFY_RUN=<dir> $S/login.sh`. Login allows 5 attempts per 15 minutes, so the token is cached in the run dir and reused.

`nest start` does not watch files. After editing `src/` or `libs/`, run cleanup and launch again.

## Doctor

`VERIFY_RUN=<dir> $S/doctor.sh` is read-only and runs whenever anything looks off. Every line must read `ok`: process alive, port owned by this run's process group, health 200, build matches checkout HEAD with no uncommitted `src/` or `libs/` edits, queues in Redis db 9, verify token accepted, no pending migrations. Fix a `FAIL` before driving.

## Drive

Pick the journey from [`features/README.md`](features/README.md); each feature file lists exact requests and expected statuses. The tools:

- `VERIFY_RUN=<dir> [AUTH=jwt|apikey|external|none] [HDR='Name: value'] [EXPECT=<status>] $S/api.sh <label> <METHOD> <path> [json | @file]` sends one request. `jwt` (default) is the verify user; `apikey` is `x-api-key` for routes marked `@ApiKeyAllowed`; `external` is a valid `X-External-Token`. The body prints on stdout (pipe to `jq`), the status and evidence path on stderr. Set `EXPECT` on every call so a wrong status fails the step.
- `VERIFY_RUN=<dir> $S/sql.sh <label> "<select ...>"` runs a read-only query (writes fail) and records it. Use it for side effects.
- `VERIFY_RUN=<dir> $S/record.sh <label> <command> [args...]` records any other read-only proof, such as `redis-cli -n 9 --scan --pattern 'rate_limit:*'` or a `grep` over `$VERIFY_RUN/server.log`.
- Large bodies go in `$VERIFY_RUN/<name>.json` (built with `jq -nc`) and are sent as `@$VERIFY_RUN/<name>.json`. Cleanup deletes them.

## Evidence

Each `api.sh` and `sql.sh` call writes a numbered file to `~/Desktop/dev/.scratch/verify-meridiano-api/<run-id>/` with time, build SHA, request, auth mode (never the credential), status and response. Cleanup copies `server.log` there too. A proof has:

- The user path: the same route and auth the frontend or CLI uses, never an internal setter or a test-only route.
- The action and the resulting state: the write's response, then a second read through a different route (for example a list view) showing the stored value.
- The side effect: a `sql.sh` row count or column showing what changed in Postgres, or the job state for queued work.
- Every entry point the feature file lists. A skipped one is reported as skipped with the unmet precondition, not as verified through another path.

## Cleanup

`VERIFY_RUN=<dir> $S/cleanup.sh` kills only the process group `launch.sh` started, copies `server.log` into the evidence dir, flushes Redis db 9 only while it carries this run's marker, and deletes the run's state files. Evidence stays. Run it after every run, failed ones included. Undo DB writes through the API inside the journey before cleanup (each feature file says how).

## Helpers

| Script | Use |
|---|---|
| `ensure-user.sh` | create or repair the verify user |
| `launch.sh [checkout]` | boot an instance, print `VERIFY_RUN=` |
| `login.sh` | cache the verify user's JWT |
| `doctor.sh` | read-only health check |
| `api.sh` | one request plus evidence |
| `sql.sh` | one read-only query plus evidence |
| `record.sh` | any other read-only command plus evidence |
| `cleanup.sh` | stop the instance, keep evidence |

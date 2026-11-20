# Meridiano API verification map

This directory is the maintained source for verifying user-facing API behavior. Read this index, then use the matching feature file as the recipe. `$S` is `.claude/skills/verify-meridiano-api/scripts`, and every helper call is prefixed with the `VERIFY_RUN=...` line `launch.sh` printed.

## Baseline preconditions

- `$S/launch.sh` printed `VERIFY_RUN=<dir>` and `$S/login.sh` cached the verify user's token.
- `$S/record.sh doctor $S/doctor.sh` prints only `ok` lines, and the evidence dir keeps them.
- The dev DB holds at least one article (`GET /api/articles?perPage=1&archive_scope=all` returns one).
- Never drive an instance this run did not launch.

## Driving conventions

- Send every request through `$S/api.sh` with `EXPECT=<status>`.
- Prove stored state with a second read through a list or detail route, then with `$S/sql.sh`.
- Writes into global data (articles, briefings) restore the original value before cleanup.
- Writes into per-user data (notes) happen as the verify user and are cleared through the API.

## Proof and skip reporting

- Report the evidence dir and the numbered files that carry each sub-feature.
- Report an unreachable path with the command tried and the unmet precondition.
- A journey whose precondition the dev data lacks reports a failure with the reason; it is not weakened to pass.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior, then exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with api.sh`, `Gotchas`.

## Features

The verify user isolates only per-user data (notes, bookmarks). Articles and briefings are global, so a journey that writes them edits the data Ana sees in her frontend. The "Shared dev data" column says what each journey changes there and how it undoes it.

| Feature | Covers | Shared dev data | Last driven |
|---|---|---|---|
| [Notes](./notes.md) | save, append, read back, 20,000 char cap, clear | none (verify user's notes, soft-deleted) | 2026-11-20, all steps pass |
| [Ask](./ask.md) | model list, answer about a source, validation | none (paid AI call) | not yet |
| [Briefings](./briefings.md) | custom briefing and title validation, custom job | rename is restored in the journey; the paid custom job leaves a new briefing, so ask Ana first | not yet |
| [External articles rate limit](./external-articles-rate-limit.md) | invented tokens share the IP bucket, valid token has its own | none (Redis db 9 only) | not yet |
| [Article processing](./article-processing.md) | submit a URL, job runs the pipeline, article stored | adds a real article, deleted in the journey; ask Ana first | not yet |

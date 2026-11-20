# Briefings

A signed-in user reads briefings per feed profile, generates a custom briefing from 2 to 10 chosen articles as a background job, and renames a briefing. Bad request bodies get a 400 before any job is queued.

## Sub-features

- `briefings-list` lists briefings, optionally by `feedProfile` and `limit`.
- `briefings-custom-validation` rejects fewer than 2 or more than 10 article ids, non-UUID ids and an unknown feed profile.
- `briefings-custom-job` queues a custom briefing and reports its job state (`GET /api/briefings/jobs/:jobId`).
- `briefings-title-validation` rejects a missing or over-200-character `customTitle`.
- `briefings-title` renames a briefing.

## How to get to it (user POV)

- Frontend: the briefings page, the custom briefing builder and the title editor.
- Any client: the `api/briefings` routes with a JWT.

## Driving it with api.sh

Preconditions:

- Baseline from the README.
- A briefing id `B` and its current title: `EXPECT=200 $S/api.sh briefings-list GET '/api/briefings?limit=1' | jq -c '.[0] // .briefings[0] | {id, custom_title, title}'`. If the dev DB has no briefing, report the title sub-features as blocked.
- Two article ids `A1`, `A2` from `GET /api/articles?perPage=2&archive_scope=all`.

- **One article.** `EXPECT=400 $S/api.sh custom-one-id POST /api/briefings/custom '{"articleIds":["<A1>"],"feedProfile":"technology"}'`.
- **Bad id.** `EXPECT=400 $S/api.sh custom-bad-id POST /api/briefings/custom '{"articleIds":["<A1>","not-a-uuid"],"feedProfile":"technology"}'`.
- **Bad profile.** `EXPECT=400 $S/api.sh custom-bad-profile POST /api/briefings/custom '{"articleIds":["<A1>","<A2>"],"feedProfile":"nope"}'`. Message `Invalid feed profile`.
- **Title too long.** `EXPECT=400 $S/api.sh title-too-long PATCH /api/briefings/<B>/title "{\"customTitle\":\"$(head -c 201 /dev/zero | tr '\0' t)\"}"`.
- **Title missing.** `EXPECT=400 $S/api.sh title-missing PATCH /api/briefings/<B>/title '{}'`.
- **Rename and restore.** `EXPECT=200 $S/api.sh title-set PATCH /api/briefings/<B>/title '{"customTitle":"verify: renamed"}'`, read it back with `GET /api/briefings/<B>`, then `PATCH` the original `custom_title` back and read again.
- **Custom job (paid).** `EXPECT=201 $S/api.sh custom-job POST /api/briefings/custom '{"articleIds":["<A1>","<A2>"],"feedProfile":"technology"}'` returns `{jobId}`. Poll `GET /api/briefings/jobs/<jobId>` until the state is final, and confirm the new briefing with `sql.sh`.

## Gotchas

- Briefings are global, not per user. A rename shows up in Ana's frontend until restored, so restore in the same journey.
- The custom job runs on the verify instance's own worker (Redis db 9) and calls the AI provider; it also writes a briefing row that stays. Run it only when the change touches briefing generation, and tell Ana the new briefing id.
- The list response shape was not checked yet; adjust the `jq` in the precondition on the first run and update this file.

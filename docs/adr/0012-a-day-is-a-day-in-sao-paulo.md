# 0012: A day in Meridiano is a day in Sao Paulo

## Status

Accepted

## Context

Meridiano had two definitions of "yesterday". `preset=yesterday` on
`GET /api/articles` resolved the calendar day with `Date` local getters, so it
answered in whatever zone the host happened to run in, while the News Digest
subtracted a hardcoded `BRT_OFFSET_MS` of three hours. Nothing in the repo sets
`TZ`, so on a UTC host the two disagreed for the last three hours of every
Brazilian day and the preset returned the reader's current day (issue #333).

A third disagreement sat under both. `published_date` is a `TIMESTAMP`
(`src/database/migrations/1735027200000-InitialSchema.ts:13`) and inserts write
`publishedDate.toISOString()`, so the column holds a UTC wall clock. Comparing
`DATE(published_date)` against a `YYYY-MM-DD` therefore cut the day at 21:00 in
Sao Paulo no matter which zone produced the date string.

## Decision

A Meridiano Day is the calendar day in `America/Sao_Paulo`, and
`src/shared/helpers/meridiano-day.ts` is the only place that resolves one.

The zone is named, not offset: the module looks the offset up per instant
through `Intl`, so it never has to be told that Brazil dropped DST in 2019 or
that it might bring it back.

`startDate` and `endDate` on the articles filter are Meridiano Days, both
inclusive, and compile to a half-open instant range
(`published_date >= start AND published_date < end`) rather than to a
`DATE(published_date)` truncation. The News Digest window is the filter's own
`yesterday` preset, so the digest and the list endpoint cannot drift apart
again.

## Consequences

Setting `TZ=America/Sao_Paulo` in the deployment was the alternative. It would
have fixed the preset without new code, but it leaves the answer depending on
an environment variable that no file in the repo sets, and it does nothing for
the `DATE(published_date)` truncation. The rule now holds on any host.

The frontend keeps sending date-only strings and the API keeps resolving them,
so the browser's zone never enters the query (meridiano-frontend #99).

`GET /api/youtube-transcriptions/lean` has its own date filter and still
documents its `startDate` and `endDate` as UTC calendar days
(`src/youtube-transcriptions/dto/list-transcriptions-lean.dto.ts:18-19`).
Transcriptions are not Articles and nothing pairs that endpoint with a digest,
so it was left alone rather than converted.

A malformed date now throws from `startOfMeridianoDay` instead of reaching
Postgres as a bad literal. The articles list endpoint still has no DTO
validating its query params, so the failure is a 500 either way.

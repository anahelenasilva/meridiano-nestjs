# 0009: Archive state is a column on articles, not a user-scoped join table

## Status

Accepted

## Context

Articles accumulate and never leave. Reading one changes nothing about whether
it appears tomorrow, so the same items keep occupying the list, the Standard
Briefing candidate pool, and News Digest selection. Bookmarks record "I want
this later"; the missing state is "I am done with this".

The obvious alternative was `article_archives (user_id, article_id, created_at)`,
mirroring the existing `bookmarks` table and ready for multi-user.

## Decision

Archive state is a nullable `archived_at TIMESTAMP` column on `articles`.

## Consequences

A join table cannot serve the read paths that need the filter. Briefing
generation runs on a queue with no user in scope, so does News Digest
selection, and `ListArticlesQuery` documents its own `userId` as undefined on
the api-key path the CLI uses. Filtering by a user-scoped table on those three
paths means resolving "the owner" out of nothing, which is the tenancy concept
ADR-0001 defers on purpose. That approach pays the multi-user cost now and
still does not deliver multi-user.

Meridiano is single-user. Archive state is a property of the article.

A timestamp rather than a boolean, because it records when the article was
archived, which orders the Archive view, and it matches the `deleted_at`
column already used by `notes`. The index is partial on the non-null side:
the archived set is the small one, and an index covering `archived_at IS NULL`
would match nearly every row and would not be used.

`youtube_transcriptions` gets no such column. Restricting archive to Articles
is enforced by the schema, not by convention.

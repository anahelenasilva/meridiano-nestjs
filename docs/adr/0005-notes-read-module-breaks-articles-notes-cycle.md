# ADR-0005: Neutral Read-Only Module to Break the Articles/Notes Dependency Cycle

## Status
Accepted

## Context
`NotesModule` imports `ArticlesModule` on the write path: saving a note validates that the parent article exists (`NotesService.assertSourceExists` calls `ArticlesService.getArticleById`).

PR #136 (issue #122) required the reverse: Article detail responses now embed the requesting user's active private note, so `ArticlesModule` needed read access to note data. Having `ArticlesModule` import `NotesModule` would form `ArticlesModule -> NotesModule -> ArticlesModule`, a circular module dependency. A prior change had already removed a `forwardRef` between these two modules deliberately; reintroducing the cycle (even disguised behind `forwardRef`) would undo that fix.

## Decision
Extract the note read path into a standalone `NotesReadService`, owned by a new `NotesReadModule` that depends only on `DatabaseModule`:

- `NotesReadModule` (`src/notes/notes-read.module.ts`) exports `NotesReadService`, which exposes `getActiveNote(userId, sourceType, sourceId)` — the single active (non-soft-deleted) note query and row mapping.
- `ArticlesModule` imports `NotesReadModule` and consumes `NotesReadService` in `GetArticleByIdQuery` to embed the owner's active note on the primary article (`related_articles` are intentionally left note-free).
- `NotesModule` also imports `NotesReadModule`. `NotesService.getActiveNote` now delegates to `NotesReadService.getActiveNote` instead of duplicating the SQL/row-mapping inline.

Neither `ArticlesModule` nor `NotesModule` imports the other's read data through one another — both depend on the neutral `NotesReadModule` leaf instead. `NotesModule` still imports `ArticlesModule` directly for its existing write-path validation; that direction is unchanged and remains acyclic since `ArticlesModule` does not import `NotesModule`.

## Alternatives considered

**`forwardRef(() => NotesModule)` in `ArticlesModule`**
Would work mechanically but reintroduces the exact circular module dependency a prior change deliberately removed. Rejected — trades a known, already-fixed problem for a new instance of the same problem.

**Add the note-embedding query directly inside `ArticlesService` (raw SQL, no `NotesService`/`NotesModule` involvement)**
Avoids the module dependency entirely. Rejected because it duplicates the active-note query/row-mapping logic that already lives in `NotesService`, with no shared source of truth — the two copies would drift.

**Merge `NotesModule` and `ArticlesModule` into one module**
Eliminates the cycle by eliminating the boundary. Rejected — the modules have distinct write-path responsibilities (note CRUD vs. article ingestion/listing) and merging them would blur that boundary well beyond what this feature requires.

## Consequences
- New pattern: when module A needs read access to module B's data but B already depends on A (or the reverse would create a cycle), extract the read path into a neutral leaf module that both depend on, rather than forming A <-> B.
- `NotesReadModule` depends only on `DatabaseModule` — it cannot import `ArticlesModule`, `NotesModule`, or `YoutubeTranscriptionsModule`, keeping it a true leaf. Any future consumer needing read-only note access should import `NotesReadModule` rather than the write-path `NotesModule`.
- Active-note query/row-mapping logic is defined once, in `NotesReadService`; `NotesService` no longer has its own copy.
- `NotesReadService` is read-only by convention (query methods only) — it must not gain write methods, or the module stops being safe for both `ArticlesModule` and `NotesModule` to depend on.

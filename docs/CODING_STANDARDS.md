# Coding Standards

The judgement rules no tool can check. The mechanical rules run in PR checks: `pnpm lint`, `pnpm lint:boundaries`, `pnpm lint:layout` and `pnpm lint:migrations`.

## Error Handling
- Never silently ignore a null or error return. Either:
  - throw a descriptive error with context (IDs, operation name),
  - store partial results for retry, if that applies,
  - or log the failure with structured data.

## API Limits
- Before sending data to an AI or external API, check its size limits. If input can exceed them, truncate or chunk before the call.

## OpenAPI
- The swagger plugin copies `@ArrayMaxSize` and `@ArrayMinSize` into `openapi.json` only when the argument is a number literal written on the DTO property. A named constant, or the decorator wrapped in `applyDecorators`, is dropped without a warning, and the CI diff check regenerates the file with the same gap. Write the literal or add `@ApiProperty({ maxItems })`, then check the limit appears in `openapi.json`.

## Parameter Propagation
- A parameter a function accepts (e.g. `customPrompt`) reaches every code path (single-pass, chunked, fallback) and every subprocess that could use it, and each path has a test that passes it.

## Tests
- Tests cover public methods, error and edge cases, and fallback paths, not only the happy path.
- A wrapper function gets a test that calls the wrapper itself, not only the functions it delegates to. If real I/O makes that look unsafe, use a fixture (tmp dir, mock) instead of excluding the wrapper from coverage.
- An assertion on a mock call or a result names only the fields the test is about. Use `expect.objectContaining` unless the test checks the exact set of keys.

## Comments
Comment **why**, not **what**: the code already says what it does. Skip comments that restate code (`// increment counter`) or a doc block that echoes the type or signature. Keep only non-obvious context: rationale, constraints, tradeoffs, warnings, issue links. Prefer a better name over a comment. If deleting a comment loses no info, delete it.

A comment that says how a tool or library behaves links the source that shows it: the docs page, or the file under `node_modules`.

Bad:
```typescript
/** Error types for audio generation jobs */
type ErrorType = 'retryable' | 'fatal';

// Validate input data
if (!text || text.trim().length === 0) { ... }
```

## Documentation
- A change to a pattern or the architecture updates the doc that describes it.
- A change to a lib updates [docs/LIBRARIES.md](./LIBRARIES.md).

## Single Source of Truth
- A config, script or doc that needs a list another file owns (ignore patterns, tsconfig paths, script names, folder sets) reads it from that file at run time or links to it.

## Module Layout
- Modules are domain contexts (Articles, Audio, Users), never a central aggregator like `UsecasesModule`. What goes in `libs/` instead of `src/` is in [libs/README.md](../libs/README.md#what-belongs-in-libs-vs-src).
- Add a command, query or usecase only when it owns logic (dedupe, sequencing, orchestration across services). If it would forward one call to a service unchanged, the controller calls the service directly.
- A module starts flat, with its files in `src/<domain>/`, and gets `commands/`, `queries/` or `usecases/` only when it has a file that passes the rule above. A flat module is finished, not legacy: `bookmarks`, `scraper` and `users` keep their logic in their services.
- Entities, helpers and extra services sit flat or in a folder named for the kind (`entities/`, `helpers/`, `services/`). Match the module you are editing, and start flat in a new one.

## Migrations
- Don't delete or rename an entity's ID column without a migration plan.

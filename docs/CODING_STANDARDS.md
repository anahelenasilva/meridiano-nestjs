# Coding Standards

## Git Operations
- Use conventional commit messages: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`

## Documentation
- Whenever you change a pattern or architecture, update the corresponding documentation.
- All documentation is in the `docs/` directory. The main documentation file is `docs/PROJECT_DOCUMENTATION_INDEX.md`.
- For architecture changes, update the [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) file.
- For library changes, update the [docs/LIBRARIES.md](docs/LIBRARIES.md) file.
- For API changes, update the [docs/API_REFERENCE.md](docs/API_REFERENCE.md) file.
- For development changes, update the [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) file.
- For project changes, update the [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) file.

## Error Handling
- NEVER silently ignore a null/error return from an operation
- ALWAYS either:
  - Throw a descriptive error with context (include IDs, operation name)
  - Store partial results for retry (if applicable)
  - Log the failure with structured data
- Empty catch blocks are FORBIDDEN

## API Limits Safety
- BEFORE sending data to any AI/external API, check for size limits
- If input could exceed limits, truncate or chunk BEFORE the API call

## Parameter Propagation
- When a function accepts a parameter (e.g., `customPrompt`), it MUST be:
  - Applied consistently to ALL code paths (single-pass, chunked, fallback)
  - Passed to all subprocesses that could use it

## Comment Policy
Only add comments when the WHY is non-obvious. Never comment what the code already expresses.

Bad:
```typescript
/** Error types for audio generation jobs */
type ErrorType = 'retryable' | 'fatal';

// Validate input data
if (!text || text.trim().length === 0) { ... }
```

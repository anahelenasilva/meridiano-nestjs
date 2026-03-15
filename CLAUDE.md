---
description: Instructions for Cursor Agent mode operations
alwaysApply: true
---

# Agent Mode Instructions

## Package Manager
- **Always use `pnpm`**, never `npm` or `yarn`
- Install packages: `pnpm add <package>` or `pnpm add -D <package>`
- Run scripts: `pnpm run <script>`

## Before Making Changes
1. Ensure Docker containers are running: `pnpm run docker:up`
2. If modifying database schema, create a migration first

## Testing
- Run unit tests before completing any task: `pnpm test`
- Run specific unit test file: `pnpm test <filename>`
- Run E2E tests: `pnpm test:e2e`
- Run specific E2E test file: `pnpm test:e2e -- <filename>`
- If tests fail, fix them before moving on

## Database Migrations
- After modifying entity interfaces that map to DB tables:
  ```bash
  pnpm run migration:generate src/database/migrations/DescriptionName
  ```
- To run pending migrations: `pnpm run migration:run`
- Never manually edit migration files after they've been run

## Development Server
- Start dev server: `pnpm run start:dev`
- The server runs on port 3000 by default
- API endpoints are prefixed with `/api/`

## Environment
- Never commit `.env` files, except the ones with names that ends with `.sample` (e.g. `.env.prod.sample`)
- Required env vars are documented in `README.md`
- For local dev, copy from `.env.example` if it exists

## File Creation
- New features go in `src/<feature-name>/` directory
- Always create the module file and register in `AppModule`
- Co-locate tests with source files (`*.spec.ts`)

## Code Changes
- Don't modify files in `node_modules/` or `dist/`
- Don't modify migration files that have already run (timestamps in the past)
- Don't delete or rename entity ID columns without a migration plan

## Git Operations
- Use conventional commit messages: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`
- Don't commit generated files (`dist/`, coverage reports)

## When Stuck
- Check Docker logs: `pnpm run docker:logs`
- Verify Redis is running: `redis-cli ping`
- Check for TypeScript errors: `pnpm run build`

## Implementation Standards

### Testing Requirements
- Every new service class MUST have a corresponding `.spec.ts` test file
- Test file must be created alongside the implementation
- Minimum coverage: all public methods, error cases, and edge cases
- Test fallback paths, not just happy paths

### Abstraction Layer Consistency
- NEVER call provider-specific methods directly (e.g., `callDeepseekChat`)
- ALWAYS use the abstraction layer (`callChat`) that respects config
- If an abstraction exists, use it—don't reach around it

### API Limits Safety
- BEFORE sending data to any AI/external API, check for size limits
- If input could exceed limits, truncate or chunk BEFORE the API call
- Document the limit and the mitigation in code comments

### Parameter Propagation
- When a function accepts a parameter (e.g., `customPrompt`), it MUST be:
  - Applied consistently to ALL code paths (single-pass, chunked, fallback)
  - Passed to all subprocesses that could use it
- Test each code path with the parameter to verify it's applied

### Error Handling Standards
- NEVER silently ignore a null/error return from an operation
- ALWAYS either:
  - Throw a descriptive error with context (include IDs, operation name)
  - Store partial results for retry (if applicable)
  - Log the failure with structured data
- Empty catch blocks are FORBIDDEN

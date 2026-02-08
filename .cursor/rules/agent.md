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
<!-- 1. Ensure Docker containers are running: `pnpm run docker:up` -->
2. If modifying database schema, create a migration first

## Testing
- Run tests before completing any task: `pnpm test`
- Run specific test file: `pnpm test <filename>`
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

# Architecture Patterns

## Module Structure

- Reduce coupling when possible
- Never create the "god module" anti-pattern — modules are domain contexts (Articles, Audio, Users, etc.), never centralized aggregators like `UsecasesModule`
- Shared infrastructure modules and cross-cutting concerns go in `libs/` at the project root

**What belongs in `libs/`:**

- Shared infrastructure modules (S3, email, database, queue)
- Reusable utilities used across multiple domain modules
- Cross-cutting concerns that don't belong to a specific domain

**What stays in `src/`:**

- Domain-specific modules (articles, users, briefings, etc.)
- Business logic and use cases
- API controllers and routes
- Domain entities and DTOs

## Import Conventions

- Use `@libs/*` path aliases for all libs imports
- Import a lib only through its root files, never a file in one of its subfolders. `pnpm lint:boundaries` enforces this, see the [libs README](../libs/README.md#import-conventions)
- Avoid relative paths like `../../libs/s3` — use `@libs/s3` instead

## CQRS Pattern

- **Commands**: Write operations that modify state (`commands/*.command.ts`)
- **Queries**: Read operations that retrieve data (`queries/*.query.ts`)
- **Usecases**: Complex business logic orchestration (`src/<domain>/usecases/`)
- All should be `@Injectable()` classes with an `execute()` method
- Add a command or query only when it owns logic (dedupe, sequencing, orchestration across services). If it would forward one call to a service unchanged, the controller calls the service directly

## Module Layout

- A module starts flat, with its files in `src/<domain>/`. It gets `commands/`, `queries/` or `usecases/` only when it has a file that passes the rule above. Never create an empty one to match another module
- A flat module is finished, not legacy. `bookmarks`, `scraper` and `users` keep their logic in their services, and nobody migrates them to the `briefings` layout
- Entities, helpers and extra services can sit flat or in a folder named for the kind (`entities/`, `helpers/`, `services/`). Both shapes exist in `src/`, so match the module you are editing, and start flat in a new one
- A class that exists only to run a queue worker (`createWorker` from `@libs/queue/create-worker`) goes in `processors/`, with its failure notifier. DTOs go in `dto/`. A usecase's input DTO can sit next to it in `usecases/dto/`
- No lint rule checks this layout

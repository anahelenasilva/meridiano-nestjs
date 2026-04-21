# Architecture Patterns

## Module Structure
- Reduce coupling when possible
- Never create the "god module" anti-pattern — modules are domain contexts (Articles, Audio, Users, etc.), never centralized aggregators like `UsecasesModule`
- Shared infrastructure modules and cross-cutting concerns go in `libs/` at the project root

**What belongs in `libs/`:**
- Shared infrastructure modules (S3, email, auth, database, queue)
- Reusable utilities used across multiple domain modules
- Cross-cutting concerns that don't belong to a specific domain

**What stays in `src/`:**
- Domain-specific modules (articles, users, briefings, etc.)
- Business logic and use cases
- API controllers and routes
- Domain entities and DTOs

## Import Conventions
- Use `@libs/*` path aliases for all libs imports
- Prefer barrel exports: `import { S3Module, S3Service } from '@libs/s3'`
- Direct file imports also work: `import { S3Module } from '@libs/s3/s3.module'`
- Avoid relative paths like `../../libs/s3` — use `@libs/s3` instead

## CQRS Pattern
- **Commands**: Write operations that modify state (`commands/*.command.ts`)
- **Queries**: Read operations that retrieve data (`queries/*.query.ts`)
- **Usecases**: Complex business logic orchestration (`src/<domain>/usecases/`)
- All should be `@Injectable()` classes with an `execute()` method

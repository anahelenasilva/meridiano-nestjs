# Architectural Patterns (CQRS-style)

Several domains keep controllers thin by splitting reads and writes into small `@Injectable()` classes:

- **Commands** (`commands/*.command.ts`): state-changing operations (for example article audio generation).
- **Queries** (`queries/*.query.ts`): reads and list/detail assembly.
- **Use cases** (`usecases/*.usecase.ts`): multi-step orchestration (for example `RunBriefingUseCase`, briefing generation, scraping pipelines).

These live next to their feature module under `src/<feature>/` rather than in a shared “use cases” module. Naming follows `*Command`, `*Query`, `*UseCase`, each with an `execute()` method.

# ADR-0006: OpenAPI Error-Response Coverage via Shared Composed Decorators

## Status
Accepted

## Context

#153 piloted generating `openapi.json` from `NotesController` via a `TestingModule`-scoped `SwaggerModule.createDocument()` call (`src/scripts/generateOpenApi.ts`), gated in CI by a diff-check. That pilot documents only the success-path response (`SaveNoteResponseDto`, via an explicit `@ApiCreatedResponse` hint) for `POST /api/notes`. It deliberately deferred status-code/response-shape coverage beyond that one endpoint's happy path — tracked as #159.

`NotesController`'s `saveNote` can also fail with:
- `400` — `SaveNoteDto`'s class-validator decorators (`@IsIn`, `@IsUUID('4')`, `@MaxLength(5000)`) fail under the global `ValidationPipe` (configured in `main.ts`'s `bootstrap()`, not in the generator).
- `401` — the global `JwtAuthGuard` (provided via `APP_GUARD` in `app.module.ts`) rejects an unauthenticated request.

Neither is documented today. `generateOpenApi.ts`'s `TestingModule` never calls `app.useGlobalPipes()`, so the generator app doesn't even have the real `ValidationPipe` wired in — only `main.ts`'s production bootstrap does. This rules out deriving the 400 shape by running real validation inside the generator; there is nothing to run it against without duplicating `main.ts`'s bootstrap config into the generator, which would itself be a second, driftable copy of that config — the exact failure mode #153's whole mechanism (spec generated from code, not hand-maintained) exists to eliminate.

No exception filter and no `@ApiResponse`/`@ApiBadRequestResponse`/`@ApiUnauthorizedResponse` usage exists anywhere else in the repo. This decision sets the pattern #154 (extending decorator coverage to the repo's other controllers) will copy across every controller, so the cost of getting it wrong multiplies with each future controller.

## Decision

Add two shared, hand-authored error-response DTOs and a pair of composed decorators, applied explicitly at the controller/method level:

- `src/shared/swagger/api-error-response.dto.ts`: `ValidationErrorResponseDto` (`{ statusCode: 400; message: string[]; error: string }`) and `UnauthorizedResponseDto` (`{ statusCode: 401; message: string }`), shapes pinned to Nest's default `ValidationPipe` exception shape and Passport's default `AuthGuard` unauthorized shape.
- `src/shared/swagger/api-error-response.decorators.ts`: `ApiValidationErrorResponse()` and `ApiAuthErrorResponse()`, each built with `applyDecorators` wrapping the corresponding `@nestjs/swagger` response decorator and DTO.
- `ApiAuthErrorResponse()` applied at controller class level (covers every route on a fully-guarded controller); `ApiValidationErrorResponse()` applied at method level only on routes with a validated `@Body()`.

This extends the precedent #153 already set for response shape (user story 6): request shape is inferred by the compiler plugin, but response shape requires an explicit hint. Status-code coverage follows the same explicit-hint model rather than reversing it.

## Alternatives considered

**Hand-authored `@ApiResponse` literal per status, per endpoint** (no shared DTO/helper)
Zero new infrastructure, matches the existing `@ApiCreatedResponse` style exactly. Rejected as the primary pattern because it doesn't scale to #154: every future controller repeats the same 400/401 boilerplate, and #154's own scope already accepts "add decorators to every controller" as its cost model — duplicating status/shape literals on top of that multiplies the cost rather than sharing it.

**Static-analysis auto-injection** — a generator-script step that introspects `@Body()` param class-validator metadata and guard/`@Public()` state at generation time, and synthesizes response metadata programmatically before `createDocument()`.
Best marginal scaling (zero decorator cost per new controller). Rejected: it moves the source of truth for "what error responses exist" off the controller's own decorators and into new script logic — decorator-metadata iteration order isn't a documented stability guarantee, so the CI diff-check's determinism is no longer purely a function of what's visibly written on the controller. It also has no real runtime behavior to derive from, since the generator app doesn't wire up the real `ValidationPipe` (see Context).

**Post-hoc JSON patching** — after `SwaggerModule.createDocument()`, walk `document.paths[*].responses` and inject 400/401 blocks by a hardcoded rule in `generateOpenApi.ts`.
Lowest marginal cost for #154. Rejected: the injection rule lives entirely outside any controller's decorators, becoming a second, hidden source of truth that a reviewer looking at a controller diff wouldn't see — precisely the independent-source-of-truth drift #153 (and PR #26 before it) was created to eliminate.

## Consequences

- New pattern: shared error-response DTOs + composed decorators live in `src/shared/swagger/`, following the existing `src/shared/` convention (`types/`, `helpers/`) for cross-module code. #154 should reuse `ApiValidationErrorResponse()`/`ApiAuthErrorResponse()` on other controllers rather than re-deriving per-controller error DTOs.
- `ApiAuthErrorResponse()` is only correct for routes that are actually behind the global guard and not `@Public()`. #154 must apply it selectively, not blanket, once controllers with `@Public()` routes are added.
- The DTOs' shapes are hand-pinned to today's `ValidationPipe` options and `JwtAuthGuard`/Passport defaults. If a custom exception filter or different pipe options are introduced later, the DTOs will go stale silently — the CI diff-check only catches drift between controller decorators and the generated spec, not drift between decorators and actual runtime exception behavior. This is an accepted limitation, not a solved problem, consistent with #153's own explicitly-written-down deferred gaps.

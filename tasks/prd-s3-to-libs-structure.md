# PRD: S3 Module to Libs Structure Migration

## Introduction

Migrate the S3 module from `src/s3/` to `libs/s3/` to establish a proper library structure for shared infrastructure modules. This refactoring separates infrastructure concerns from domain logic and establishes patterns for future migrations of other infrastructure modules (email, auth, database, queue) to the same structure. The migration uses TypeScript path aliases (`@libs/*`) and barrel exports for clean, maintainable imports.

## Goals

- Establish `libs/` directory structure for shared infrastructure modules
- Migrate S3 module to `libs/s3/` with zero breaking changes
- Configure TypeScript path aliases (`@libs/*`) for clean imports
- Create barrel exports (`index.ts`) for simplified import syntax
- Configure Jest (ts-jest) to resolve libs paths correctly
- Document patterns and conventions for future libs migrations
- Maintain all existing functionality and test coverage

## User Stories

### US-001: Create libs directory structure
**Description:** As a developer, I want a `libs/` directory at the project root so that infrastructure modules can be organized separately from domain logic.

**Acceptance Criteria:**
- [ ] `libs/` directory exists at project root
- [ ] `libs/s3/` directory structure is created
- [ ] Directory structure follows NestJS module conventions
- [ ] Typecheck passes

### US-002: Move S3 module files to libs
**Description:** As a developer, I want S3 module files moved to `libs/s3/` so that the module is organized as a shared infrastructure library.

**Acceptance Criteria:**
- [ ] All S3 module files moved to `libs/s3/` using `git mv` (preserves history)
- [ ] Files moved: `s3.module.ts`, `s3.service.ts`, `s3.module.spec.ts`, `s3.service.spec.ts`
- [ ] No files remain in `src/s3/`
- [ ] `src/s3/` directory removed
- [ ] Git history preserved (verified with `git log --follow`)
- [ ] Typecheck passes

### US-003: Create barrel export for S3 module
**Description:** As a developer, I want a barrel export (`index.ts`) in `libs/s3/` so that imports can use `@libs/s3` instead of explicit file paths.

**Acceptance Criteria:**
- [ ] `libs/s3/index.ts` file created
- [ ] Exports `S3Module` and `S3Service`
- [ ] Imports work with both `@libs/s3` and `@libs/s3/s3.module` patterns
- [ ] Typecheck passes

### US-004: Configure TypeScript path aliases
**Description:** As a developer, I want TypeScript configured to resolve `@libs/*` path aliases so that imports work correctly across the codebase.

**Acceptance Criteria:**
- [ ] `tsconfig.json` includes `@libs/*` path mapping to `libs/*`
- [ ] `tsconfig.json` includes `libs/**/*` in compilation paths
- [ ] TypeScript compilation succeeds (`pnpm build`)
- [ ] IDE autocomplete works for `@libs/s3` imports
- [ ] Typecheck passes

### US-005: Configure Jest path mapping for libs
**Description:** As a developer, I want Jest configured to resolve `@libs/*` paths using ts-jest so that tests can import from libs without errors.

**Acceptance Criteria:**
- [ ] `package.json` jest config includes `moduleNameMapper` for `@libs/*`
- [ ] ts-jest path mapping configured correctly
- [ ] All unit tests pass (`pnpm test`)
- [ ] S3Service tests work with new import paths
- [ ] S3Module tests work with new import paths
- [ ] Tests in `articles` and `queue` modules pass with updated imports

### US-006: Update all S3 import statements
**Description:** As a developer, I want all S3 imports updated to use `@libs/s3` so that the codebase references the correct module location.

**Acceptance Criteria:**
- [ ] `src/app.module.ts` import updated to `@libs/s3`
- [ ] `src/articles/articles.module.ts` import updated to `@libs/s3`
- [ ] `src/articles/articles.controller.ts` import updated to `@libs/s3`
- [ ] `src/queue/queue.module.ts` import updated to `@libs/s3`
- [ ] `src/queue/processors/markdown-article.processor.ts` import updated to `@libs/s3`
- [ ] `src/queue/processors/markdown-article.processor.spec.ts` import updated to `@libs/s3`
- [ ] All imports use `@libs/s3` pattern (barrel export)
- [ ] No references to `src/s3/` or `../s3/` remain
- [ ] Typecheck passes

### US-007: Verify functionality after migration
**Description:** As a developer, I want all existing functionality to work after migration so that no breaking changes are introduced.

**Acceptance Criteria:**
- [ ] All unit tests pass (`pnpm test`)
- [ ] All integration tests pass (`pnpm test:e2e`)
- [ ] Application builds successfully (`pnpm build`)
- [ ] Application starts without errors (`pnpm start:dev`)
- [ ] S3 service methods work correctly (`downloadMarkdownFile`, `generatePresignedPostUrl`)
- [ ] No runtime errors related to module resolution
- [ ] Articles API endpoints work (presigned URL generation)
- [ ] Queue processor can download from S3

### US-008: Update .cursorrules documentation
**Description:** As a developer, I want `.cursorrules` updated to document the libs structure so that future development follows established patterns.

**Acceptance Criteria:**
- [ ] `.cursorrules` includes section on libs directory structure
- [ ] Documents what belongs in `libs/` vs `src/`
- [ ] Documents import conventions (`@libs/*`)
- [ ] Documents barrel export pattern
- [ ] Typecheck passes

### US-009: Create libs README documentation
**Description:** As a developer, I want a `libs/README.md` documenting the libs structure so that patterns are clear for future migrations.

**Acceptance Criteria:**
- [ ] `libs/README.md` file created
- [ ] Documents purpose of libs directory
- [ ] Explains what belongs in libs vs src
- [ ] Documents import conventions
- [ ] Documents testing patterns for libs
- [ ] Includes examples of proper usage
- [ ] Lists current libs (S3) and planned migrations

## Functional Requirements

- FR-1: Create `libs/` directory at project root
- FR-2: Move all S3 module files from `src/s3/` to `libs/s3/` preserving git history
- FR-3: Create `libs/s3/index.ts` barrel export exporting `S3Module` and `S3Service`
- FR-4: Configure TypeScript path alias `@libs/*` mapping to `libs/*` in `tsconfig.json`
- FR-5: Include `libs/**/*` in TypeScript compilation paths
- FR-6: Configure Jest `moduleNameMapper` to resolve `@libs/*` paths
- FR-7: Update all import statements from `../s3/` or `./s3/` to `@libs/s3`
- FR-8: Remove `src/s3/` directory after migration
- FR-9: Update `.cursorrules` with libs structure documentation
- FR-10: Create `libs/README.md` with structure documentation and patterns

## Non-Goals

- No changes to S3 service functionality or API
- No changes to S3 module exports or public interface
- No migration of other infrastructure modules (email, auth, database, queue) - only establish patterns
- No changes to build or deployment processes
- No changes to environment variables or configuration
- No creation of separate npm packages or monorepo structure

## Design Considerations

### Directory Structure
```
libs/
└── s3/
    ├── index.ts          # Barrel export
    ├── s3.module.ts
    ├── s3.module.spec.ts
    ├── s3.service.ts
    └── s3.service.spec.ts
```

### Import Patterns
- Preferred: `import { S3Module, S3Service } from '@libs/s3';`
- Also valid: `import { S3Module } from '@libs/s3/s3.module';`
- Avoid: Relative paths like `../../libs/s3`

### What Belongs in libs/
- Shared infrastructure modules (S3, email, auth, database, queue)
- Reusable utilities used across multiple domain modules
- Cross-cutting concerns

### What Stays in src/
- Domain-specific modules (articles, users, briefings, etc.)
- Business logic and use cases
- API controllers and routes
- Domain entities and DTOs

## Technical Considerations

### TypeScript Configuration
- Use `nodenext` module resolution (already configured)
- Add path mapping: `"@libs/*": ["libs/*"]`
- Include `libs/**/*` in compilation
- Ensure `baseUrl` is set to `"."`

### Jest Configuration
- Use `moduleNameMapper` in `package.json` jest config
- Map `^@libs/(.*)$` to `<rootDir>/../libs/$1` (since rootDir is `src`)
- Or adjust `rootDir` to include both `src` and `libs`

### Git History Preservation
- Use `git mv` instead of regular `mv` to preserve file history
- Verify with `git log --follow libs/s3/s3.service.ts`

### Files Requiring Import Updates
1. `src/app.module.ts`
2. `src/articles/articles.module.ts`
3. `src/articles/articles.controller.ts`
4. `src/queue/queue.module.ts`
5. `src/queue/processors/markdown-article.processor.ts`
6. `src/queue/processors/markdown-article.processor.spec.ts`

### ESLint Configuration
- ESLint already configured to lint `libs/**/*.ts` (from package.json)
- No changes needed

## Success Metrics

- All tests pass (unit and e2e)
- Application builds successfully
- Application starts without errors
- No runtime errors related to module resolution
- All imports use consistent `@libs/s3` pattern
- Git history preserved for moved files
- Documentation updated (.cursorrules and libs/README.md)
- Code review approval

## Open Questions

- Should we add a lint rule to enforce `@libs/*` imports over relative paths?
- Should we create a script to automate future libs migrations?
- Should we add a pre-commit hook to verify libs structure?

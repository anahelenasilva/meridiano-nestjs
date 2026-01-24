# PRD: Email Module to Libs Structure Migration

## Introduction

Migrate the email module from `src/email/` to `libs/email/` to establish a proper library structure for shared infrastructure modules. This refactoring follows the pattern established by the S3 module migration and separates infrastructure concerns from domain logic. The email module provides a provider-agnostic email service that supports multiple email providers (currently Mailgun) with easy switching via environment variables. The migration uses TypeScript path aliases (`@libs/*`) and barrel exports for clean, maintainable imports.

## Goals

- Migrate email module to `libs/email/` following established libs patterns
- Maintain zero breaking changes to existing functionality
- Update barrel export to only export `EmailModule` and `EmailService` (matching S3 pattern)
- Create basic test structure files following S3 pattern
- Update all import statements to use `@libs/email`
- Update documentation to reflect libs structure and patterns
- Preserve git history for all moved files

## User Stories

### US-001: Create libs/email directory structure
**Description:** As a developer, I want a `libs/email/` directory structure so that the email module is organized as a shared infrastructure library.

**Acceptance Criteria:**
- [ ] `libs/email/` directory exists at project root
- [ ] Subdirectories created: `interfaces/`, `providers/`
- [ ] Directory structure follows NestJS module conventions
- [ ] Typecheck passes

### US-002: Move email module files to libs
**Description:** As a developer, I want email module files moved to `libs/email/` so that the module is organized as a shared infrastructure library.

**Acceptance Criteria:**
- [ ] All email module files moved to `libs/email/` using `git mv` (preserves history)
- [ ] Files moved: `email.module.ts`, `email.service.ts`, `index.ts`
- [ ] `interfaces/` directory moved with: `email-provider.interface.ts`, `send-email-options.interface.ts`
- [ ] `providers/` directory moved with: `mailgun.provider.ts`
- [ ] `README.md` moved to `libs/email/README.md`
- [ ] No files remain in `src/email/`
- [ ] `src/email/` directory removed
- [ ] Git history preserved (verified with `git log --follow`)
- [ ] Typecheck passes

### US-003: Update barrel export for email module
**Description:** As a developer, I want the barrel export (`index.ts`) in `libs/email/` to only export `EmailModule` and `EmailService` so that imports follow the same pattern as other libs modules.

**Acceptance Criteria:**
- [ ] `libs/email/index.ts` updated to export only `EmailModule` and `EmailService`
- [ ] Removed exports of interfaces and providers (internal implementation details)
- [ ] Imports work with both `@libs/email` and `@libs/email/email.module` patterns
- [ ] Internal module files can still import interfaces/providers using relative paths
- [ ] Typecheck passes

### US-004: Update all email import statements
**Description:** As a developer, I want all email imports updated to use `@libs/email` so that the codebase references the correct module location.

**Acceptance Criteria:**
- [ ] `src/queue/queue.module.ts` import updated to `@libs/email`
- [ ] `src/queue/queue.service.ts` import updated to `@libs/email`
- [ ] All imports use `@libs/email` pattern (barrel export)
- [ ] No references to `src/email/` or `../email/` remain
- [ ] Internal email module files use relative imports for interfaces/providers
- [ ] Typecheck passes

### US-005: Create basic test structure files
**Description:** As a developer, I want basic test structure files created for the email module so that testing patterns are established following the S3 module pattern.

**Acceptance Criteria:**
- [ ] `libs/email/email.module.spec.ts` file created with basic test structure
- [ ] `libs/email/email.service.spec.ts` file created with basic test structure
- [ ] Tests use `jest-mock-extended` for mocking (following project patterns)
- [ ] Tests follow NestJS testing module pattern
- [ ] Tests can import from `@libs/email` without errors
- [ ] All tests pass (even if minimal initially)
- [ ] Typecheck passes

### US-006: Update email module README
**Description:** As a developer, I want the email module README updated to reflect the libs structure and import patterns so that documentation is accurate and helpful.

**Acceptance Criteria:**
- [ ] `libs/email/README.md` updated with libs import examples
- [ ] Examples use `@libs/email` import pattern
- [ ] Documentation explains `forRoot()` pattern and when to use it
- [ ] Examples show proper module import: `EmailModule.forRoot()`
- [ ] Examples show proper service injection: `EmailService`
- [ ] Documentation matches libs structure patterns
- [ ] Typecheck passes

### US-007: Update libs README documentation
**Description:** As a developer, I want `libs/README.md` updated to include the email module so that it's documented as a current library.

**Acceptance Criteria:**
- [ ] `libs/README.md` updated with email module in "Current Libraries" section
- [ ] Documents `EmailModule` and `EmailService` exports
- [ ] Documents `forRoot()` initialization pattern
- [ ] Documents supported providers (Mailgun)
- [ ] Includes usage examples with `@libs/email` imports
- [ ] Removes email from "Planned Migrations" section
- [ ] Typecheck passes

### US-008: Update .cursorrules documentation
**Description:** As a developer, I want `.cursorrules` updated if needed to document email module patterns so that future development follows established conventions.

**Acceptance Criteria:**
- [ ] `.cursorrules` reviewed for email-specific patterns
- [ ] If email module has unique patterns (like `forRoot()`), they are documented
- [ ] Import conventions documented if not already covered
- [ ] Typecheck passes

### US-009: Verify functionality after migration
**Description:** As a developer, I want all existing functionality to work after migration so that no breaking changes are introduced.

**Acceptance Criteria:**
- [ ] All unit tests pass (`pnpm test`)
- [ ] All integration tests pass (`pnpm test:e2e`)
- [ ] Application builds successfully (`pnpm build`)
- [ ] Application starts without errors (`pnpm start:dev`)
- [ ] Email service methods work correctly (`sendEmail`)
- [ ] Queue service can send failure notification emails
- [ ] No runtime errors related to module resolution
- [ ] Email provider initialization works correctly

## Functional Requirements

- FR-1: Create `libs/email/` directory structure with `interfaces/` and `providers/` subdirectories
- FR-2: Move all email module files from `src/email/` to `libs/email/` preserving git history
- FR-3: Update `libs/email/index.ts` barrel export to only export `EmailModule` and `EmailService`
- FR-4: Update all import statements from `../email/` or `./email/` to `@libs/email`
- FR-5: Create `libs/email/email.module.spec.ts` with basic test structure
- FR-6: Create `libs/email/email.service.spec.ts` with basic test structure
- FR-7: Update `libs/email/README.md` with libs structure patterns and `forRoot()` documentation
- FR-8: Update `libs/README.md` to add email module to "Current Libraries" section
- FR-9: Review and update `.cursorrules` if email-specific patterns need documentation
- FR-10: Remove `src/email/` directory after migration
- FR-11: Ensure internal email module files use relative imports for interfaces/providers

## Non-Goals

- No changes to email service functionality or API
- No changes to email module `forRoot()` initialization pattern
- No changes to email provider interface or implementations
- No changes to environment variables or configuration
- No changes to build or deployment processes
- No comprehensive test coverage (only basic test structure)
- No migration of other infrastructure modules (auth, database, queue) - only email
- No creation of separate npm packages or monorepo structure

## Design Considerations

### Directory Structure
```
libs/
└── email/
    ├── index.ts                    # Barrel export (EmailModule, EmailService only)
    ├── email.module.ts             # NestJS module with forRoot()
    ├── email.module.spec.ts        # Module tests
    ├── email.service.ts            # Email service implementation
    ├── email.service.spec.ts       # Service tests
    ├── README.md                   # Updated documentation
    ├── interfaces/
    │   ├── email-provider.interface.ts
    │   └── send-email-options.interface.ts
    └── providers/
        └── mailgun.provider.ts
```

### Import Patterns
- Preferred: `import { EmailModule, EmailService } from '@libs/email';`
- Also valid: `import { EmailModule } from '@libs/email/email.module';`
- Avoid: Relative paths like `../../libs/email`
- Internal: Email module files use relative imports for interfaces/providers

### Module Initialization Pattern
The email module uses `EmailModule.forRoot()` which is different from simpler modules like S3. This pattern:
- Allows dynamic provider selection based on environment variables
- Uses dependency injection tokens for provider abstraction
- Should be documented in README to explain when and why to use `forRoot()`

### Barrel Export Scope
Following the S3 pattern, the barrel export (`index.ts`) only exports:
- `EmailModule` - The NestJS module
- `EmailService` - The public service API

Interfaces and providers are internal implementation details and not exported from the barrel.

## Technical Considerations

### TypeScript Configuration
- TypeScript path alias `@libs/*` already configured (from S3 migration)
- No changes needed to `tsconfig.json`
- Ensure `libs/**/*` is included in compilation paths

### Jest Configuration
- Jest path mapping already configured (from S3 migration)
- No changes needed to `package.json` jest config
- Tests should use `@libs/email` imports

### Git History Preservation
- Use `git mv` instead of regular `mv` to preserve file history
- Verify with `git log --follow libs/email/email.service.ts`
- Move entire directory structure preserving subdirectories

### Files Requiring Import Updates
1. `src/queue/queue.module.ts` - Update `EmailModule` import
2. `src/queue/queue.service.ts` - Update `EmailService` import

### Internal Module Structure
- `email.module.ts` imports interfaces/providers using relative paths (internal)
- `email.service.ts` imports interfaces using relative paths (internal)
- `mailgun.provider.ts` imports interfaces using relative paths (internal)
- These internal imports remain unchanged

### Test Structure
- Follow S3 module test patterns
- Use `jest-mock-extended` for type-safe mocks
- Use NestJS `Test.createTestingModule()` pattern
- Mock `EMAIL_PROVIDER_TOKEN` for service tests

## Success Metrics

- All tests pass (unit and e2e)
- Application builds successfully
- Application starts without errors
- No runtime errors related to module resolution
- All imports use consistent `@libs/email` pattern
- Git history preserved for moved files
- Documentation updated (libs/README.md and email/README.md)
- Basic test structure files created and passing
- Email functionality works correctly (queue failure notifications)
- Code review approval

## Open Questions

- Should we add a lint rule to enforce `@libs/*` imports over relative paths?
- Should we create a script to automate future libs migrations?
- Should we add a pre-commit hook to verify libs structure?
- Should we document the `forRoot()` pattern in `.cursorrules` for future modules that need dynamic configuration?

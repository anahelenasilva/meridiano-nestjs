# PRD: Database Module Lib Structure Refactor

## Introduction

Move the database module from `src/database/` to `libs/database/` to improve code organization, separate infrastructure from domain logic, and enable easier testing and mocking. The database infrastructure will follow the same pattern as other libs (auth, email, s3), making it reusable and more maintainable.

## Goals

- Improve code organization by centralizing database infrastructure in `libs/`
- Separate concerns between domain logic and infrastructure
- Enable easier testing and mocking of database operations
- Establish consistent patterns for infrastructure modules across the project
- Maintain backward compatibility during the transition

## User Stories

### US-001: Create libs/database module structure
**Description:** As a developer, I need to create the libs/database directory structure so that database infrastructure follows the project's lib pattern.

**Acceptance Criteria:**
- [ ] Create `libs/database/` directory with module structure
- [ ] Create `database.module.ts` with `@Global()` decorator
- [ ] Create `database.service.ts` with core database operations
- [ ] Create `database.interface.ts` with database service interface
- [ ] Create `index.ts` barrel export exporting DatabaseModule and DatabaseService
- [ ] Typecheck passes

### US-002: Move database service implementations to libs
**Description:** As a developer, I need to move database service implementations to libs/database so that infrastructure is properly separated.

**Acceptance Criteria:**
- [ ] Move `database.service.ts` implementation to `libs/database/`
- [ ] Move `abstract-database.service.ts` to `libs/database/`
- [ ] Move `postgres-database.service.ts` to `libs/database/`
- [ ] Update all internal imports within database services
- [ ] Typecheck passes
- [ ] All tests pass

### US-003: Update TypeORM configuration for libs module
**Description:** As a developer, I need to update TypeORM configuration to work within the libs/database module structure.

**Acceptance Criteria:**
- [ ] Move or reference `typeorm.config.ts` from libs/database
- [ ] Update DatabaseModule to import TypeOrmModule.forRoot() with correct config
- [ ] Ensure migration path resolves correctly from libs location
- [ ] Keep @Global() decorator on DatabaseModule
- [ ] Typecheck passes

### US-004: Update AppModule imports to use libs/database
**Description:** As a developer, I need to update AppModule to import DatabaseModule from @libs/database instead of src/database.

**Acceptance Criteria:**
- [ ] Update `app.module.ts` to import from `@libs/database`
- [ ] Remove import from `src/database/database.module`
- [ ] Verify app starts successfully with new import
- [ ] Typecheck passes

### US-005: Update all service imports to use @libs/database
**Description:** As a developer, I need to update all service files across the codebase to import DatabaseService from @libs/database.

**Acceptance Criteria:**
- [ ] Search and replace all `from '../database/` imports with `from '@libs/database'`
- [ ] Search and replace all `from './database/` imports with `from '@libs/database'`
- [ ] Verify no remaining imports from src/database in service files
- [ ] Typecheck passes
- [ ] All tests pass

### US-006: Update all module imports to use @libs/database
**Description:** As a developer, I need to update all module files to import DatabaseModule from @libs/database.

**Acceptance Criteria:**
- [ ] Update all feature modules that import DatabaseModule
- [ ] Verify no module files import from src/database
- [ ] Typecheck passes
- [ ] All tests pass

### US-007: Create alias migration for backward compatibility
**Description:** As a developer, I need to create a temporary alias in src/database that points to libs/database to allow gradual migration without breaking changes.

**Acceptance Criteria:**
- [ ] Create `src/database/database.module.ts` that re-exports from @libs/database
- [ ] Create `src/database/database.service.ts` that re-exports from @libs/database
- [ ] Create `src/database/database.interface.ts` that re-exports from @libs/database
- [ ] Add JSDoc comment indicating this is temporary for migration
- [ ] Typecheck passes
- [ ] All tests pass

### US-008: Update migration scripts to use libs/database
**Description:** As a developer, I need to update CLI scripts that interact with the database to work with the new libs location.

**Acceptance Criteria:**
- [ ] Update migration:generate script to work with libs/database config
- [ ] Update migration:create script to work with libs/database config
- [ ] Update migration:run script to work with libs/database config
- [ ] Update migration:revert script to work with libs/database config
- [ ] Test each migration command successfully
- [ ] Typecheck passes

### US-009: Update TypeScript path aliases
**Description:** As a developer, I need to ensure TypeScript configuration includes the @libs/database path alias.

**Acceptance Criteria:**
- [ ] Verify `@libs/database` is in tsconfig.json paths
- [ ] Verify path alias resolves correctly
- [ ] No TypeScript errors when using @libs/database imports
- [ ] Typecheck passes

### US-010: Add tests to libs/database module
**Description:** As a developer, I need to add unit tests for the libs/database module following the project's testing patterns.

**Acceptance Criteria:**
- [ ] Create `database.module.spec.ts` with module initialization tests
- [ ] Create `database.service.spec.ts` with service tests
- [ ] Use jest-mock-extended for mocking dependencies
- [ ] All tests pass
- [ ] Test coverage meets project standards

### US-011: Update libs/database README
**Description:** As a developer, I need to create documentation for the libs/database module following the pattern of other libs.

**Acceptance Criteria:**
- [ ] Create `libs/database/README.md` with module overview
- [ ] Document DatabaseService API and methods
- [ ] Include usage examples
- [ ] Document configuration requirements
- [ ] Follow same format as libs/s3/README.md

### US-012: Remove temporary src/database aliases
**Description:** As a developer, I need to remove the temporary alias files in src/database after confirming all imports are updated.

**Acceptance Criteria:**
- [ ] Verify no files still import from src/database
- [ ] Delete src/database/database.module.ts alias
- [ ] Delete src/database/database.service.ts alias
- [ ] Delete src/database/database.interface.ts alias
- [ ] Keep src/database/migrations/ directory (as per requirement)
- [ ] Typecheck passes
- [ ] All tests pass

### US-013: Remove old src/database service files
**Description:** As a developer, I need to remove the old database service implementation files from src/database after migration is complete.

**Acceptance Criteria:**
- [ ] Delete src/database/database.service.ts (original)
- [ ] Delete src/database/abstract-database.service.ts
- [ ] Delete src/database/postgres-database.service.ts
- [ ] Delete src/database/database.interface.ts (original)
- [ ] Delete src/database/typeorm.config.ts (or verify it's properly referenced)
- [ ] Verify src/database/ now contains only migrations/
- [ ] Typecheck passes
- [ ] All tests pass

### US-014: Update project documentation
**Description:** As a developer, I need to update project documentation to reflect the new database module location.

**Acceptance Criteria:**
- [ ] Update README.md to reference @libs/database
- [ ] Update .cursorrules to reflect new structure
- [ ] Update any architecture docs that reference database module
- [ ] Verify all documentation references are consistent

## Functional Requirements

- FR-1: Create `libs/database/` directory with standard lib structure (module, service, index.ts)
- FR-2: Move DatabaseService implementation to libs/database/ with @Global() decorator
- FR-3: Export DatabaseModule and DatabaseService via barrel export (index.ts)
- FR-4: Keep database migrations in src/database/migrations/ (do NOT move to libs)
- FR-5: Maintain @Global() decorator pattern on DatabaseModule
- FR-6: Update all imports from `src/database/*` to `@libs/database`
- FR-7: Update TypeORM configuration to work from libs location
- FR-8: Update migration CLI scripts to work with new structure
- FR-9: Add unit tests for libs/database module
- FR-10: Create README documentation for libs/database
- FR-11: Use backward-compatible aliases during migration (gradual transition)
- FR-12: Update TypeScript path aliases to include @libs/database
- FR-13: Remove temporary aliases after migration is complete
- FR-14: Update project documentation to reflect new structure

## Non-Goals

- NO changes to database schema or migrations
- NO changes to DatabaseService public API
- NO changes to database connection logic or behavior
- NO moving migration files to libs (they stay in src/database/migrations/)
- NO breaking changes during the transition (use aliases)
- NO changes to TypeORM configuration values
- NO changes to database initialization or shutdown behavior

## Technical Considerations

### Current DatabaseModule Structure
- Uses @Global() decorator to make it available everywhere
- Exports DatabaseService and TypeOrmModule
- Runs migrations automatically on startup via OnModuleInit
- Initializes and closes database connection via DatabaseService

### Lib Pattern
- Other libs (s3, email, auth) follow consistent structure
- Barrel export (index.ts) for clean imports
- Use @libs/* path aliases throughout the project
- Module, service, interfaces, and tests in lib directory
- README documentation in each lib

### Migration Strategy
- Break into multiple small PRs to minimize disruption
- Create temporary aliases in src/database for backward compatibility
- Update imports gradually across the codebase
- Remove aliases only after all imports are updated
- Keep migrations in src/database/migrations/ as per requirement

### Import Path Aliases
- Use `@libs/database` for all imports
- Update tsconfig.json paths if needed
- Follow same pattern as @libs/auth, @libs/s3, @libs/email

### Testing
- Follow existing test patterns using jest-mock-extended
- Test module initialization and service methods
- Ensure tests pass after each PR in the migration

## Success Metrics

- All imports use @libs/database path alias
- No remaining imports from src/database (except in aliases during migration)
- Typecheck passes without errors
- All tests pass after migration is complete
- Application starts and runs successfully with new structure
- Migration CLI commands work correctly
- Database connections, queries, and migrations work as before
- Zero downtime or breaking changes during transition

## Open Questions

- Should we update the README to use @libs/database examples before or after the migration completes?
- Do we need to update any CI/CD pipelines or deployment scripts that reference the database module?
- Are there any external tools or scripts (outside the repo) that import from the database module?

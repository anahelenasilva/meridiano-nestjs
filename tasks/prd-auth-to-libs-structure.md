# PRD: Auth Module to Libs Structure Migration

## Introduction

Migrate the authentication infrastructure from `src/auth/` to `libs/auth/` following the established libs pattern, while keeping the controller in `src/auth/` since controllers are domain-specific. This refactoring separates authentication infrastructure (guards, strategies, decorators, service) from the domain-specific controller, making the auth infrastructure reusable and properly organized. The migration decouples `AuthService` from `UsersService` by introducing a user lookup provider interface, enabling better separation of concerns. All authentication-related exports (module, service, guard, decorator, DTOs) will be available via `@libs/auth` barrel export.

## Goals

- Migrate auth infrastructure to `libs/auth/` following established libs patterns
- Keep `AuthController` in `src/auth/` (controllers are domain-specific)
- Decouple `AuthService` from `UsersService` via user lookup provider interface
- Export `AuthModule`, `AuthService`, `JwtAuthGuard`, `Public` decorator, and DTOs from barrel export
- Maintain zero breaking changes to existing functionality
- Update all import statements to use `@libs/auth` where appropriate
- Preserve git history for all moved files
- Create basic test structure files following libs patterns

## User Stories

### US-001: Create libs/auth directory structure
**Description:** As a developer, I want a `libs/auth/` directory structure so that the auth infrastructure is organized as a shared library.

**Acceptance Criteria:**
- [ ] `libs/auth/` directory exists at project root
- [ ] Subdirectories created: `decorators/`, `guards/`, `strategies/`, `dto/`, `interfaces/`
- [ ] Directory structure follows NestJS module conventions
- [ ] Typecheck passes

### US-002: Create user lookup provider interface
**Description:** As a developer, I want a user lookup provider interface so that `AuthService` can be decoupled from `UsersService`.

**Acceptance Criteria:**
- [ ] `libs/auth/interfaces/user-lookup-provider.interface.ts` created
- [ ] Interface defines `getUserByEmail(email: string, includePassword: boolean)` method
- [ ] Interface defines `getUserById(userId: string)` method
- [ ] Interface properly typed with return types matching User entity structure
- [ ] Typecheck passes

### US-003: Move auth service to libs with provider injection
**Description:** As a developer, I want `AuthService` moved to `libs/auth/` and refactored to use the user lookup provider interface so that it's decoupled from domain-specific services.

**Acceptance Criteria:**
- [ ] `libs/auth/auth.service.ts` created (moved from `src/auth/auth.service.ts`)
- [ ] `AuthService` constructor accepts `UserLookupProvider` interface instead of `UsersService`
- [ ] `login()` method uses provider interface methods
- [ ] `validateUser()` method uses provider interface methods
- [ ] Service maintains all existing functionality
- [ ] Typecheck passes

### US-004: Move auth module to libs with provider configuration
**Description:** As a developer, I want `AuthModule` moved to `libs/auth/` and configured to accept a user lookup provider so that it can work with any user service implementation.

**Acceptance Criteria:**
- [ ] `libs/auth/auth.module.ts` created (moved from `src/auth/auth.module.ts`)
- [ ] `AuthModule` uses `forRoot()` or `forRootAsync()` pattern to accept user lookup provider
- [ ] Module registers `UserLookupProvider` token with provided implementation
- [ ] Module configures `JwtModule` and `PassportModule` as before
- [ ] Module exports `AuthService` for use in other modules
- [ ] Module does NOT import `UsersModule` (decoupled)
- [ ] Typecheck passes

### US-005: Move guards, decorators, and strategies to libs
**Description:** As a developer, I want guards, decorators, and strategies moved to `libs/auth/` so that authentication infrastructure is centralized.

**Acceptance Criteria:**
- [ ] `libs/auth/guards/jwt-auth.guard.ts` created (moved from `src/auth/guards/jwt-auth.guard.ts`)
- [ ] `libs/auth/decorators/public.decorator.ts` created (moved from `src/auth/decorators/public.decorator.ts`)
- [ ] `libs/auth/strategies/jwt.strategy.ts` created (moved from `src/auth/strategies/jwt.strategy.ts`)
- [ ] All imports updated to use relative paths within libs/auth
- [ ] `JwtStrategy` uses `AuthService` from libs/auth
- [ ] Typecheck passes

### US-006: Move DTOs to libs
**Description:** As a developer, I want DTOs moved to `libs/auth/dto/` so that they're part of the public API and can be imported by controllers.

**Acceptance Criteria:**
- [ ] `libs/auth/dto/login.dto.ts` created (moved from `src/auth/dto/login.dto.ts`)
- [ ] `libs/auth/dto/login-response.dto.ts` created (moved from `src/auth/dto/login-response.dto.ts`)
- [ ] DTOs maintain all validation decorators and structure
- [ ] Typecheck passes

### US-007: Create barrel export for libs/auth
**Description:** As a developer, I want a barrel export in `libs/auth/index.ts` that exports the public API so that imports are clean and consistent.

**Acceptance Criteria:**
- [ ] `libs/auth/index.ts` created
- [ ] Exports `AuthModule` from `./auth.module`
- [ ] Exports `AuthService` from `./auth.service`
- [ ] Exports `JwtAuthGuard` from `./guards/jwt-auth.guard`
- [ ] Exports `Public` decorator and `IS_PUBLIC_KEY` from `./decorators/public.decorator`
- [ ] Exports `LoginDto` from `./dto/login.dto`
- [ ] Exports `LoginResponseDto` from `./dto/login-response.dto`
- [ ] Does NOT export internal interfaces or strategies
- [ ] Typecheck passes

### US-008: Create src/auth directory with only controller
**Description:** As a developer, I want `src/auth/` to contain only the controller so that controllers remain domain-specific while infrastructure is in libs.

**Acceptance Criteria:**
- [ ] `src/auth/auth.controller.ts` remains in `src/auth/`
- [ ] Controller imports from `@libs/auth` for service, DTOs, and decorator
- [ ] Controller maintains all existing functionality
- [ ] `src/auth/auth.module.ts` created as thin wrapper that imports `AuthModule` from libs
- [ ] Wrapper module imports `UsersModule` and provides `UserLookupProvider` implementation
- [ ] Wrapper module registers `AuthController`
- [ ] Typecheck passes

### US-009: Create user lookup provider implementation
**Description:** As a developer, I want a `UserLookupProvider` implementation that wraps `UsersService` so that the auth module can work with the existing user service.

**Acceptance Criteria:**
- [ ] `src/auth/providers/user-lookup.provider.ts` created
- [ ] Implements `UserLookupProvider` interface from `@libs/auth/interfaces/user-lookup-provider.interface`
- [ ] Wraps `UsersService` methods: `getUserByEmail()` and `getUserById()`
- [ ] Properly handles `includePassword` parameter
- [ ] Injectable provider class
- [ ] Typecheck passes

### US-010: Update all auth imports across codebase
**Description:** As a developer, I want all auth-related imports updated to use `@libs/auth` so that the codebase references the correct module location.

**Acceptance Criteria:**
- [ ] `src/app.module.ts` imports `AuthModule` from `@libs/auth`
- [ ] `src/app.module.ts` imports `JwtAuthGuard` from `@libs/auth`
- [ ] `src/app.controller.ts` imports `Public` from `@libs/auth`
- [ ] `src/users/users.controller.ts` imports `Public` from `@libs/auth`
- [ ] `src/auth/auth.controller.ts` imports service, DTOs, and decorator from `@libs/auth`
- [ ] No references to `src/auth/` for infrastructure (only controller remains)
- [ ] Typecheck passes

### US-011: Create basic test structure files
**Description:** As a developer, I want basic test structure files created for the auth module so that testing patterns are established following libs patterns.

**Acceptance Criteria:**
- [ ] `libs/auth/auth.module.spec.ts` file created with basic test structure
- [ ] `libs/auth/auth.service.spec.ts` file created with basic test structure
- [ ] `libs/auth/guards/jwt-auth.guard.spec.ts` file created with basic test structure
- [ ] Tests use `jest-mock-extended` for mocking (following project patterns)
- [ ] Tests follow NestJS testing module pattern
- [ ] Tests can import from `@libs/auth` without errors
- [ ] All tests pass (even if minimal initially)
- [ ] Typecheck passes

### US-012: Update libs README documentation
**Description:** As a developer, I want `libs/README.md` updated to include the auth module so that it's documented as a current library.

**Acceptance Criteria:**
- [ ] `libs/README.md` updated with auth module in "Current Libraries" section
- [ ] Documents `AuthModule`, `AuthService`, `JwtAuthGuard`, `Public` decorator exports
- [ ] Documents `forRoot()` or `forRootAsync()` initialization pattern
- [ ] Documents user lookup provider interface requirement
- [ ] Includes usage examples with `@libs/auth` imports
- [ ] Shows how to configure `UserLookupProvider` in wrapper module
- [ ] Removes auth from "Planned Migrations" section
- [ ] Typecheck passes

### US-013: Update .cursorrules if needed
**Description:** As a developer, I want `.cursorrules` updated if needed to document auth module patterns so that future development follows established conventions.

**Acceptance Criteria:**
- [ ] `.cursorrules` reviewed for auth-specific patterns
- [ ] If auth module has unique patterns (like `forRoot()` with provider), they are documented
- [ ] Import conventions documented if not already covered
- [ ] User lookup provider pattern documented
- [ ] Typecheck passes

### US-014: Verify functionality after migration
**Description:** As a developer, I want all existing functionality to work after migration so that no breaking changes are introduced.

**Acceptance Criteria:**
- [ ] All unit tests pass (`pnpm test`)
- [ ] All integration tests pass (`pnpm test:e2e`)
- [ ] Application builds successfully (`pnpm build`)
- [ ] Application starts without errors (`pnpm start:dev`)
- [ ] Login endpoint works correctly (`POST /api/auth/login`)
- [ ] JWT authentication works for protected routes
- [ ] `@Public()` decorator works correctly
- [ ] Global `JwtAuthGuard` works correctly
- [ ] No runtime errors related to module resolution
- [ ] User lookup provider works correctly

## Functional Requirements

- FR-1: Create `libs/auth/` directory structure with subdirectories: `decorators/`, `guards/`, `strategies/`, `dto/`, `interfaces/`
- FR-2: Create `UserLookupProvider` interface in `libs/auth/interfaces/user-lookup-provider.interface.ts`
- FR-3: Move `AuthService` to `libs/auth/` and refactor to use `UserLookupProvider` interface
- FR-4: Move `AuthModule` to `libs/auth/` and configure to accept user lookup provider via `forRoot()` or `forRootAsync()`
- FR-5: Move guards, decorators, and strategies to `libs/auth/` preserving git history
- FR-6: Move DTOs to `libs/auth/dto/` preserving git history
- FR-7: Create barrel export `libs/auth/index.ts` exporting: `AuthModule`, `AuthService`, `JwtAuthGuard`, `Public` decorator, `IS_PUBLIC_KEY`, `LoginDto`, `LoginResponseDto`
- FR-8: Keep `AuthController` in `src/auth/` and update imports to use `@libs/auth`
- FR-9: Create `src/auth/auth.module.ts` wrapper that imports `AuthModule` from libs and configures `UserLookupProvider`
- FR-10: Create `src/auth/providers/user-lookup.provider.ts` implementing `UserLookupProvider` interface
- FR-11: Update all imports across codebase to use `@libs/auth` where appropriate
- FR-12: Create basic test structure files: `auth.module.spec.ts`, `auth.service.spec.ts`, `jwt-auth.guard.spec.ts`
- FR-13: Update `libs/README.md` to document auth module
- FR-14: Review and update `.cursorrules` if auth-specific patterns need documentation
- FR-15: Remove old `src/auth/` files after migration (except controller and wrapper module)

## Non-Goals

- No changes to authentication functionality or API
- No changes to JWT token structure or expiration
- No changes to password hashing (bcrypt)
- No changes to environment variables or configuration
- No changes to build or deployment processes
- No comprehensive test coverage (only basic test structure)
- No migration of other infrastructure modules (database, queue) - only auth
- No creation of separate npm packages or monorepo structure
- No changes to how `@Public()` decorator works
- No changes to global guard registration pattern

## Design Considerations

### Directory Structure
```
libs/
└── auth/
    ├── index.ts                              # Barrel export
    ├── auth.module.ts                        # NestJS module with forRoot()
    ├── auth.module.spec.ts                   # Module tests
    ├── auth.service.ts                       # Auth service (uses provider)
    ├── auth.service.spec.ts                  # Service tests
    ├── interfaces/
    │   └── user-lookup-provider.interface.ts # User lookup interface
    ├── guards/
    │   ├── jwt-auth.guard.ts
    │   └── jwt-auth.guard.spec.ts
    ├── decorators/
    │   └── public.decorator.ts
    ├── strategies/
    │   └── jwt.strategy.ts                   # Internal (not exported)
    └── dto/
        ├── login.dto.ts
        └── login-response.dto.ts

src/
└── auth/
    ├── auth.module.ts                        # Wrapper module
    ├── auth.controller.ts                    # Controller only
    └── providers/
        └── user-lookup.provider.ts           # UsersService wrapper
```

### Import Patterns
- Preferred: `import { AuthModule, AuthService, JwtAuthGuard, Public } from '@libs/auth';`
- Also valid: `import { AuthModule } from '@libs/auth/auth.module';`
- Avoid: Relative paths like `../../libs/auth`
- Internal: Auth module files use relative imports for strategies/interfaces

### Module Initialization Pattern
The auth module uses `AuthModule.forRoot()` or `AuthModule.forRootAsync()` pattern:
- Accepts `UserLookupProvider` implementation via dependency injection
- Allows dynamic configuration of user lookup mechanism
- Decouples auth infrastructure from domain-specific user services
- Should be documented in README to explain when and why to use `forRoot()`

### Barrel Export Scope
The barrel export (`index.ts`) exports:
- `AuthModule` - The NestJS module
- `AuthService` - The public service API
- `JwtAuthGuard` - The authentication guard
- `Public` decorator and `IS_PUBLIC_KEY` - For marking public routes
- `LoginDto` and `LoginResponseDto` - Public API DTOs

Internal implementation details (strategies, interfaces) are not exported from the barrel.

### User Lookup Provider Pattern
- `UserLookupProvider` interface defines contract for user lookup
- `UsersService` wrapper implements interface in `src/auth/providers/`
- Wrapper module (`src/auth/auth.module.ts`) provides the implementation
- Enables auth infrastructure to work with any user service implementation

## Technical Considerations

### TypeScript Configuration
- TypeScript path alias `@libs/*` already configured (from S3/Email migrations)
- No changes needed to `tsconfig.json`
- Ensure `libs/**/*` is included in compilation paths

### Jest Configuration
- Jest path mapping already configured (from S3/Email migrations)
- No changes needed to `package.json` jest config
- Tests should use `@libs/auth` imports

### Git History Preservation
- Use `git mv` instead of regular `mv` to preserve file history
- Verify with `git log --follow libs/auth/auth.service.ts`
- Move entire directory structure preserving subdirectories

### Files Requiring Import Updates
1. `src/app.module.ts` - Update `AuthModule` and `JwtAuthGuard` imports
2. `src/app.controller.ts` - Update `Public` decorator import
3. `src/users/users.controller.ts` - Update `Public` decorator import
4. `src/auth/auth.controller.ts` - Update service, DTOs, and decorator imports
5. `src/auth/auth.module.ts` - New wrapper module with provider configuration

### Internal Module Structure
- `auth.module.ts` imports strategies/interfaces using relative paths (internal)
- `auth.service.ts` imports interfaces using relative paths (internal)
- `jwt.strategy.ts` imports service using relative paths (internal)
- These internal imports remain unchanged

### Test Structure
- Follow S3/Email module test patterns
- Use `jest-mock-extended` for type-safe mocks
- Use NestJS `Test.createTestingModule()` pattern
- Mock `UserLookupProvider` for service tests
- Mock `JwtService` and `AuthService` for guard tests

### User Lookup Provider Implementation
- Create `UserLookupProvider` interface with required methods
- Create `UserLookupProviderImpl` in `src/auth/providers/` that wraps `UsersService`
- Register provider in wrapper module using dependency injection token
- Ensure proper typing and error handling

## Success Metrics

- All tests pass (unit and e2e)
- Application builds successfully
- Application starts without errors
- No runtime errors related to module resolution
- All imports use consistent `@libs/auth` pattern
- Git history preserved for moved files
- Documentation updated (libs/README.md)
- Basic test structure files created and passing
- Authentication functionality works correctly (login, JWT validation, public routes)
- User lookup provider pattern works correctly
- Code review approval

## Open Questions

- Should we add a lint rule to enforce `@libs/*` imports over relative paths?
- Should we create a script to automate future libs migrations?
- Should we add a pre-commit hook to verify libs structure?
- Should we document the `forRoot()` with provider pattern in `.cursorrules` for future modules that need dynamic configuration?
- Should we create a `@CurrentUser()` decorator as part of this migration (currently doesn't exist)?

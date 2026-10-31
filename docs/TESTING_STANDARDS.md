# Testing Standards

## Commands
- Run all unit tests: `pnpm test`
- Run specific test file: `pnpm test <filename>`
- Run E2E tests: `pnpm test:e2e`
- Run specific E2E test: `pnpm test:e2e -- <filename>`
- Run before completing any task; fix failures before moving on

`test/jest-e2e.json` sets `forceExit`. A spec whose `createTestingModule().compile()`
throws never gets an app to close, so the ioredis socket `RedisService` opens in its
constructor stays open and Jest waits on it forever (issue #329). `forceExit` makes the
suite report its result and exit. If you need to find a new leak, drop it for the run and
add `--detectOpenHandles`.

## File Conventions
- Co-locate test files with source: `feature.ts` → `feature.spec.ts`
- Every new service class MUST have a corresponding `.spec.ts`
- Create test file alongside implementation

## Coverage Requirements
- All public methods
- Error cases and edge cases
- Fallback paths, not just happy paths
- When a function accepts a new parameter, test each code path with it

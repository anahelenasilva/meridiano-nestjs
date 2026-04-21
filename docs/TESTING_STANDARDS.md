# Testing Standards

## Commands
- Run all unit tests: `pnpm test`
- Run specific test file: `pnpm test <filename>`
- Run E2E tests: `pnpm test:e2e`
- Run specific E2E test: `pnpm test:e2e -- <filename>`
- Run before completing any task; fix failures before moving on

## File Conventions
- Co-locate test files with source: `feature.ts` → `feature.spec.ts`
- Every new service class MUST have a corresponding `.spec.ts`
- Create test file alongside implementation

## Coverage Requirements
- All public methods
- Error cases and edge cases
- Fallback paths, not just happy paths
- When a function accepts a new parameter, test each code path with it

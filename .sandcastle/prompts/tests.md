# Context

!`git log --oneline -5`

!`find src -name "*.service.ts" -o -name "*.controller.ts" | sort`

!`find src -name "*.spec.ts" | sort`

# Task

Read `docs/TESTING_STANDARDS.md` in full before writing anything.

Find every `.service.ts` and `.controller.ts` file under `src/` that does not have a corresponding `.spec.ts` file next to it. For each such file, generate a `.spec.ts` test file co-located with the source.

Rules:
- Use `@nestjs/testing` (`Test.createTestingModule`) for module setup
- Use `jest.fn()` for all external dependencies (other services, repositories, HTTP clients)
- Cover all public methods
- Cover error cases, edge cases, and fallback paths — not just happy paths
- Follow every convention in `docs/TESTING_STANDARDS.md`
- Do NOT install any new packages
- Do NOT modify any existing source files

Output: one `.spec.ts` file next to each untested source file.

Run `pnpm test` after writing all files. Fix any failures before finishing.

# Done

When all tests pass and no untested `.service.ts` or `.controller.ts` remains, output <promise>COMPLETE</promise>.

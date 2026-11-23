---
name: mutation-testing
description: Use after `pnpm test:mutation` runs, to turn its Survived and NoCoverage mutants into stronger unit tests and report the mutation score per file before and after.
---

# Kill surviving mutants with tests

`pnpm test:mutation` (see `scripts/test-mutation.sh`) runs StrykerJS against the unit suite and writes `reports/mutation/mutation.json`. Each mutant that Survived or has NoCoverage is a change to the code that no unit test noticed. This skill works through them. The score informs you; it does not gate the ticket, so do not chase 100%.

## 1. Record the score before

Copy the per-file rows of the clear-text table Stryker prints at the end of the run (`% Mutation score total`, `# killed`, `# survived`, `# no cov`). That is the "before" column of the table in step 5.

## 2. List the mutants

```bash
jq -r '.files | to_entries[] | .key as $file | .value.mutants[] | select(.status == "Survived" or .status == "NoCoverage") | [$file, .location.start.line, .status, .mutatorName, .replacement] | @tsv' reports/mutation/mutation.json
```

One line per mutant: file, line, status, mutator, replacement. The line count equals `# survived` plus `# no cov` in the clear-text table. For the exact columns, open the `source` of that file in the report or read the `[Survived]` diff Stryker printed above the table.

## 3. Decide each mutant

Every mutant gets exactly one of these outcomes.

- **Survived: kill it with a test.** A survivor means a unit test runs the line but asserts nothing that the replacement changes. Add or tighten an assertion in the sibling spec (`foo.ts` → `foo.spec.ts`) that fails with the replacement in place and passes without it. Check that by applying the replacement by hand, running the spec, and reverting the source file with `git checkout -- <file>` before you commit.
- **NoCoverage: cover it with a unit test,** unless an e2e spec already exercises the line. Stryker runs the unit suite only, so a line only an e2e spec reaches, such as controller wiring or a guard, reports as NoCoverage. Find the route or caller that reaches the line, `grep` `test/*.e2e-spec.ts` for it, and when a spec makes that request, skip the mutant and name the spec and the request it makes. A Survived mutant is never skipped this way: a unit test already runs that line, so kill it there.
- **Equivalent: skip it with one reason.** The replacement behaves the same as the original, for example a changed log or error-message string nobody asserts on, or `>=` where both sides can never be equal. Name the mutant and the reason in one line.

Never change `src/` or `libs/` code to kill a mutant. If the only way to kill one is to change the code, the mutant is equivalent or the code has a real bug: report it, do not fix it in this pass.

## 4. Rerun

Run `pnpm test:mutation` again with the same arguments and copy the clear-text table. Then run `pnpm test` so the new assertions pass outside Stryker too.

## 5. Report

In the PR body's Evidence section, list the score per file as a table, plus every skipped mutant with its reason:

```markdown
| File   | Score before | Score after | Survived after | No cov after |
| ------ | ------------ | ----------- | -------------- | ------------ |
| <file> | <score>      | <score>     | <count>        | <count>      |

Skipped:

- `libs/database/type-parsers.ts:23` NoCoverage StringLiteral `""`: equivalent, `""` and `'text'` both fall through to the text parser
- `<file>:<line>` NoCoverage <mutator>: exercised by `test/<name>.e2e-spec.ts` (`<METHOD> /api/<route>`)
```

# Context

!`git log --oneline -10`

!`git diff main...HEAD --name-only`

!`git diff main...HEAD`

# Task

Read every file in `docs/` before writing anything:
- `docs/ARCHITECTURE_PATTERNS.md`
- `docs/CODING_STANDARDS.md`
- `docs/TESTING_STANDARDS.md`
- `docs/DATABASE_MIGRATIONS.md`
- `docs/LIBRARIES.md`
- `docs/TECHNICAL_OVERVIEW.md`

Review all files changed on this branch (shown in the diff above) against those standards.

For each finding, record:
- Severity: `ERROR` (violates a standard) | `WARNING` (should be fixed) | `NOTE` (suggestion)
- File and line reference: `file:line`
- Which standard is violated and why

Write all findings to `REVIEW.md` at the repo root using this format:

```
# Code Review

## Summary
<brief overall assessment>

## Findings

### [SEVERITY] file:line
**Standard:** <which doc and rule>
**Issue:** <what is wrong>
**Suggestion:** <how to fix>
```

Do NOT modify any source files. Do NOT modify any files other than `REVIEW.md`.

# Done

When `REVIEW.md` is written, output <promise>COMPLETE</promise>.

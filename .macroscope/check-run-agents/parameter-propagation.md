---
title: Parameter propagation
model: claude-sonnet-5-5
effort: low
input: incremental
include:
  - "src/**/*.ts"
  - "libs/**/*.ts"
exclude:
  - "**/*.spec.ts"
  - "**/*.d.ts"
maxRuns: 1
maxBudgetPerRun: 0.4
maxBudgetPerPR: 0.4
---
Rule, from docs/CODING_STANDARDS.md "Parameter Propagation": a parameter or
option field a function accepts (for example `customPrompt`, a model id, a
language, a limit) reaches every code path that could use it: single-pass,
chunked, retry and fallback paths, and every queue job, processor or
subprocess the function hands work to.

Look only at parameters and option fields the diff adds, renames or starts
passing. For each one, trace it from the entry point (controller, processor,
CLI script) through every branch that does the work. Report a violation when
a branch drops it, replaces it with a hardcoded value or a default, or builds
a job payload without it. Read the code before reporting; do not guess from
names.

For each violation, post one inline comment on the line where the value is
lost, naming the parameter, the entry point it came from and the path that
drops it. Also say whether a spec passes the parameter through that path.

Report success with no comments when the diff adds no such parameter or every
path carries it.

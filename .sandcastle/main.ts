import { run, claudeCode, createWorktree } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { join } from "node:path";

const task = process.env.TASK ?? "plan";
const promptFile = join(import.meta.dirname, `${task}-prompt.md`);

const promptArgs: Record<string, string> = {};
for (const key of ["ISSUE_NUMBER", "ISSUE_TITLE", "BRANCH", "BRANCHES", "ISSUES"]) {
  if (process.env[key]) promptArgs[key] = process.env[key]!;
}

await run({
  agent: claudeCode("claude-sonnet-4-6"),
  sandbox: docker(),
  promptFile,
  promptArgs,
});

// Parallel worktree example (uncomment and adapt as needed):
// const worktrees = await Promise.all([
//   createWorktree({ branchStrategy: { type: "branch", branchName: "sandcastle/issue-1-foo" } }),
//   createWorktree({ branchStrategy: { type: "branch", branchName: "sandcastle/issue-2-bar" } }),
// ]);
// await Promise.all(
//   worktrees.map((wt) =>
//     wt.run({ agent: claudeCode("claude-sonnet-4-6"), sandbox: docker(), promptFile })
//   )
// );
// await Promise.all(worktrees.map((wt) => wt.close()));

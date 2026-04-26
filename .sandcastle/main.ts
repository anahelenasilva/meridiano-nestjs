import { claudeCode, run } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { join } from "node:path";

const task = process.env.TASK ?? "feature";
const promptFile = join(import.meta.dirname, "prompts", `${task}.md`);

await run({
  agent: claudeCode("claude-sonnet-4-6"),
  sandbox: docker(),
  promptFile,
});

// Parallel worktree example (import createWorktree, then uncomment and adapt as needed):
// const worktrees = await Promise.all([
//   createWorktree({ branchStrategy: { type: "branch", branchName: "feature/a" } }),
//   createWorktree({ branchStrategy: { type: "branch", branchName: "feature/b" } }),
// ]);
// await Promise.all(
//   worktrees.map((wt) =>
//     wt.run({ agent: claudeCode("claude-sonnet-4-6"), sandbox: docker(), promptFile })
//   )
// );
// await Promise.all(worktrees.map((wt) => wt.close()));

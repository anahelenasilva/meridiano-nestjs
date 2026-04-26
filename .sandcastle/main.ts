import { run, claudeCode, createWorktree } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { join } from "node:path";
import {
  logEventToConsole,
  notifySlackStart,
  notifySlackToolCall,
  notifySlackComplete,
  notifySlackError,
  recordNotionSuccess,
  recordNotionError,
  type RunContext,
} from "./observers.ts";

const task = process.env.TASK ?? "plan";
const promptFile = join(import.meta.dirname, `${task}-prompt.md`);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logPath = join(import.meta.dirname, "logs", `${task}-${timestamp}.log`);

const promptArgs: Record<string, string> = {};
for (const key of ["ISSUE_NUMBER", "ISSUE_TITLE", "BRANCH", "BRANCHES", "ISSUES"]) {
  if (process.env[key]) promptArgs[key] = process.env[key]!;
}

const ctx: RunContext = {
  task,
  branch: process.env.BRANCH ?? "",
  issueNumber: process.env.ISSUE_NUMBER,
  logPath,
};

const start = Date.now();
notifySlackStart(ctx);

try {
  const result = await run({
    agent: claudeCode("claude-sonnet-4-6"),
    sandbox: docker(),
    promptFile,
    promptArgs,
    logging: {
      type: "file",
      path: logPath,
      onAgentStreamEvent: (event) => {
        logEventToConsole(event);
        if (event.type === "toolCall") notifySlackToolCall(event);
      },
    },
  });

  const durationSec = Math.round((Date.now() - start) / 1000);
  notifySlackComplete(ctx, durationSec, result.commits.length, result.iterations.length);
  recordNotionSuccess(ctx, durationSec, result.commits.length, result.iterations.length);
} catch (err) {
  const durationSec = Math.round((Date.now() - start) / 1000);
  notifySlackError(ctx, durationSec, err);
  recordNotionError(ctx, durationSec, err);
  throw err;
}

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

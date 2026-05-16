// Sequential Reviewer — implement-then-review-then-merge loop
//
// This template drives a three-phase workflow per issue:
//   Phase 1 (Implement): A sonnet agent picks an open GitHub issue, works on it
//                        on a dedicated branch, commits the changes, and signals
//                        completion.
//   Phase 2 (Review):    A second sonnet agent reviews the branch diff and either
//                        approves it or makes corrections directly on the branch.
//   Phase 3 (Merge):     A third agent merges the reviewed branch into main,
//                        resolves any conflicts, verifies tests, and closes the issue.
//
// The outer loop repeats up to MAX_ITERATIONS times, processing one issue per
// iteration. This is a middle-complexity option between the simple-loop (no review
// gate) and the parallel-planner (concurrent execution with a planning phase).
//
// Usage:
//   npx tsx .sandcastle/main.mts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.mts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Safety cap on implement→review→merge cycles. Each cycle handles one issue.
// The loop exits naturally when the implementer makes no commits (no more open issues).
const MAX_CYCLES = 20;

// How many times sandcastle may restart Claude Code within a single implementer
// session if it exits without emitting <promise>COMPLETE</promise>.
const IMPLEMENTER_MAX_ITERATIONS = 1;

// Hooks run inside the sandbox before the agent starts each iteration.
// Use the repo's package manager and allow enough time to rebuild Linux
// dependencies after copying host node_modules into the worktree.
const hooks = {
  sandbox: {
    onSandboxReady: [
      {
        command: "CI=true pnpm install --frozen-lockfile --prefer-offline",
        timeoutMs: 500_000,
      },
    ],
  },
};

// Persist the pnpm store across sandbox runs on the host so that
// --prefer-offline installs are fast after the first run.
// resolveUserMounts requires the directory to exist, so we create it here.
const pnpmStoreDir = join(homedir(), ".cache", "sandcastle-pnpm-store");
mkdirSync(pnpmStoreDir, { recursive: true });

// node_modules is intentionally excluded: copying macOS-specific modules into
// a Linux container causes pnpm to purge and reinstall everything anyway,
// which costs more time than not copying. The persistent host-side pnpm store
// (mounted below) makes --prefer-offline installs fast after the first run.
const copyToWorktree: string[] = [];

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
  console.log(`\n=== Cycle ${cycle} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Implement
  //
  // A sonnet agent picks the next open GitHub issue, creates a branch, writes
  // the implementation (using RGR: Red → Green → Repeat → Refactor), and
  // commits the result.
  //
  // The agent signals completion via <promise>COMPLETE</promise> when done.
  // The result contains the branch name the agent worked on.
  // -------------------------------------------------------------------------
  const implementBranch = `sandcastle/impl/${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;

  let implement: Awaited<ReturnType<typeof sandcastle.run>> | undefined;
  try {
    implement = await sandcastle.run({
      hooks,
      copyToWorktree,
      sandbox: docker({
        mounts: [
          {
            hostPath: pnpmStoreDir,
            sandboxPath: "~/.local/share/pnpm/store",
          },
        ],
      }),
      branchStrategy: { type: "branch", branch: implementBranch },
      name: "implementer",
      maxIterations: IMPLEMENTER_MAX_ITERATIONS,
      idleTimeoutSeconds: 420,
      agent: sandcastle.claudeCode("claude-sonnet-4-6"),
      promptFile: "./.sandcastle/implement-prompt.md",
    });
  } catch (err) {
    const isIdleTimeout =
      typeof err === "object" &&
      err !== null &&
      (err as Record<string, unknown>)["_tag"] === "AgentIdleTimeoutError";
    if (!isIdleTimeout) throw err;
    console.warn("\nImplementer hit idle timeout. Checking branch for commits before continuing...");
  }

  // When recovering from an idle timeout, implement is undefined — fall back to
  // the pre-computed branch name and read commits directly from git.
  const branch = implement?.branch ?? implementBranch;
  const stdout = implement?.stdout ?? "";
  let issueId = stdout.match(/<issue>(\d+)<\/issue>/)?.[1];
  if (!issueId) {
    // Fallback: scrape the log file. The path is deterministic — sandcastle
    // replaces /\:*?"<>| with - and appends the agent name.
    const sanitize = (s: string) => s.replace(/[/\\:*?"<>|]/g, "-");
    const logPath = join(
      process.cwd(),
      ".sandcastle",
      "logs",
      `${sanitize(implementBranch)}-implementer.log`,
    );
    try {
      const logContent = readFileSync(logPath, "utf8");
      issueId = logContent.match(/<issue>(\d+)<\/issue>/)?.[1];
    } catch {
      // log not found or unreadable — issueId stays undefined
    }
  }
  if (!issueId) {
    console.warn("Warning: implementer did not output an <issue> tag. The issue will not be closed after merge.");
  }

  // When implement is undefined (idle timeout recovery), count commits on the
  // branch directly rather than trusting the (missing) sandcastle result.
  const commits =
    implement?.commits ??
    (() => {
      try {
        const out = execSync(`git log ${branch} --not main --oneline`, {
          encoding: "utf8",
        }).trim();
        return out ? out.split("\n") : [];
      } catch {
        return [];
      }
    })();
  if (!commits.length) {
    console.log("Implementation agent made no commits. No more issues to process.");
    break;
  }

  console.log(`\nImplementation complete on branch: ${branch}`);
  console.log(`Commits: ${commits.length}`);

  // -------------------------------------------------------------------------
  // Phase 2: Review
  //
  // A second sonnet agent reviews the diff of the branch produced by Phase 1.
  // It uses the {{BRANCH}} prompt argument to inspect the right branch, and
  // either approves or makes corrections directly on the branch.
  // -------------------------------------------------------------------------
  await sandcastle.run({
    hooks,
    copyToWorktree,
    sandbox: docker({
      mounts: [
        {
          hostPath: pnpmStoreDir,
          sandboxPath: "~/.local/share/pnpm/store",
        },
      ],
    }),
    branchStrategy: { type: "branch", branch },
    name: "reviewer",
    maxIterations: 1,
    agent: sandcastle.claudeCode("claude-sonnet-4-6"),
    promptFile: "./.sandcastle/review-prompt.md",
    // Prompt arguments substitute {{BRANCH}} in review-prompt.md before the
    // agent sees the prompt.
    promptArgs: {
      BRANCH: branch,
    },
  });

  console.log("\nReview complete.");

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  //
  // A third agent merges the reviewed feature branch back into the head branch,
  // resolving any conflicts and verifying tests pass.
  // -------------------------------------------------------------------------
  await sandcastle.run({
    hooks,
    copyToWorktree,
    sandbox: docker({
      mounts: [
        {
          hostPath: pnpmStoreDir,
          sandboxPath: "~/.local/share/pnpm/store",
        },
      ],
    }),
    branchStrategy: { type: "merge-to-head" },
    name: "merger",
    maxIterations: 1,
    agent: sandcastle.claudeCode("claude-sonnet-4-6"),
    promptFile: "./.sandcastle/merge-prompt.md",
    promptArgs: {
      BRANCH: branch,
      ISSUE_ID: issueId ?? "",
    },
  });

  console.log("\nMerge complete.");
}

console.log("\nAll done.");

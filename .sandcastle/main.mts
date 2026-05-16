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
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of implement→review cycles to run before stopping.
// Each cycle works on one issue. Raise this to process more issues per run.
const MAX_ITERATIONS = 1;

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

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phases 1 + 2: Implement → Review (shared Docker container)
  //
  // A single sandbox spans both phases so that the container is started once
  // and reused, saving the pnpm install overhead on the second agent.
  // sandbox[Symbol.asyncDispose] runs exactly once when this block exits,
  // even if an exception is thrown mid-phase.
  // -------------------------------------------------------------------------
  const implementBranch = `sandcastle/impl/${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`;

  // Hoist so the merge phase (outside the block) can read these.
  let branch = implementBranch;
  let issueId: string | undefined;

  {
    await using sandbox = await sandcastle.createSandbox({
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
    });

    // -----------------------------------------------------------------------
    // Phase 1: Implement
    // -----------------------------------------------------------------------
    let implementResult: Awaited<ReturnType<typeof sandbox.run>> | undefined;
    try {
      implementResult = await sandbox.run({
        name: "implementer",
        maxIterations: 1,
        idleTimeoutSeconds: 420,
        agent: sandcastle.claudeCode("claude-sonnet-4-6"),
        promptFile: "./.sandcastle/implement-prompt.md",
        output: sandcastle.Output.string({ tag: "issue" }),
      });
    } catch (err) {
      const isIdleTimeout =
        typeof err === "object" &&
        err !== null &&
        (err as Record<string, unknown>)["_tag"] === "AgentIdleTimeoutError";
      if (!isIdleTimeout) throw err;
      console.warn("\nImplementer hit idle timeout. Checking branch for commits before continuing...");
    }

    branch = implementResult?.branch ?? implementBranch;
    issueId = implementResult?.output;

    if (!issueId) {
      console.warn("Warning: implementer did not output an <issue> tag. The issue will not be closed after merge.");
    }

    // When implementResult is undefined (idle timeout), read commits from git.
    const commits =
      implementResult?.commits ??
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
      console.log("Implementation agent made no commits. Skipping review.");
      continue;
    }

    console.log(`\nImplementation complete on branch: ${branch}`);
    console.log(`Commits: ${commits.length}`);

    // -----------------------------------------------------------------------
    // Phase 2: Review
    // -----------------------------------------------------------------------
    await sandbox.run({
      name: "reviewer",
      maxIterations: 1,
      agent: sandcastle.claudeCode("claude-sonnet-4-6"),
      promptFile: "./.sandcastle/review-prompt.md",
      promptArgs: {
        BRANCH: branch,
        SOURCE_BRANCH: "main",
      },
    });

    console.log("\nReview complete.");
  }
  // sandbox disposed here — one container for both phases above.

  // -------------------------------------------------------------------------
  // Phase 3: Merge
  //
  // Separate top-level sandcastle.run() so the merger targets the head branch
  // from a clean worktree via branchStrategy: merge-to-head.
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

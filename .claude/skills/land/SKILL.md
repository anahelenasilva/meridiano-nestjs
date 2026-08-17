---
name: land
description: Use when the user says a PR merged or landed, asks to clean up a branch after merging, or wants an issue closed once its PR is in.
---

A PR has **landed** once its merge is confirmed on GitHub — every step below runs off that fact, never off "it's probably merged."

## Steps

### 1. Confirm it landed

Resolve the PR: the one the user named, or inferred from the current branch (`gh pr view --json number,state,mergedAt,mergeCommit`) if that resolves to exactly one. If it doesn't, ask which PR.

Landed means `state == "MERGED"`. Anything else — open, or closed without merging — stops the skill here; report the actual state instead of proceeding to cleanup.

### 2. Clean the branch

If the session is in a worktree for this branch, remove it (`ExitWorktree`, `action: "remove"`) — `discard_changes: true` is safe here, since the branch's commits already live in the merge commit on the default branch.

Otherwise: switch to the default branch, delete the feature branch with `git branch -d` (never `-D` — a refusal to delete means it isn't actually merged, a signal to stop and investigate, not force through), and prune stale remote-tracking refs (`git fetch --prune`).

Done when `git branch -a` no longer lists the feature branch, locally or under `origin/*`.

### 3. Fast-forward the default branch

Pull the default branch (`gh repo view --json defaultBranchRef` if it isn't obviously `main`/`master`). Expect a fast-forward; if it isn't one, stop and surface why instead of force-resolving.

Done when the local default branch's HEAD matches origin's.

### 4. Close the issue

Check the issue's current state first — many PRs auto-close their linked issue via a "Closes #N" in the body. If already `CLOSED`, this step is a no-op; note it and move on.

If still open, close it with a comment naming the PR: `gh issue close <N> --comment "Merged via #<PR>."`

Done when the issue's state is `CLOSED`, however it got there.

### 5. Check the parent

Every issue might be a sub-issue of another. Work out whether this one is, and whether closing it just made its parent closable too — full detection mechanics (native GitHub sub-issues, plus a text-convention fallback for repos that predate it) are in [SUBISSUES.md](SUBISSUES.md).

- No parent found → done, nothing further.
- Parent found but a sibling sub-issue is still open → done, nothing further. Do not close it, do not flag it as pending.
- Parent found and every sibling is now closed → ask the user whether to close the parent too. Closing it is never automatic, however confident the detection — this is the one step in this skill a human signs off on. If they say yes, close it with a comment naming the child issues that completed it.

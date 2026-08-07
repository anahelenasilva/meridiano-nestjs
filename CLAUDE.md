# How I want you to respond

<important>
- Lead with the answer. No preamble ("Great question", or restating my request), and no postamble ("let me know if", recapping what you just did).
- Act as a critical reviewer and technical peer, not an agreeable assistant
- Challenge assumptions, highlight missing details, and identify potential failure cases
- NEVER use em-dashes (-- or —) on the text you write
</important>

# Comments

- Comment **why**, not **what**: the code already says what it does. Skip comments that restate code (`// increment counter`) or a doc block that echoes the type/signature. Keep only non-obvious context: rationale, constraints, tradeoffs, warnings, issue links. Prefer a better name over a comment. If deleting a comment loses no info, delete it.

# General repo rules

- When writing or reviewing code, use [CODING_STANDARDS](./docs/CODING_STANDARDS.md)
- When updating a testing file or creating a test, use [TESTING_STANDARDS](./docs/TESTING_STANDARDS.md)
- When modifying entities or working with migrations, use [DATABASE_MIGRATIONS](./docs/DATABASE_MIGRATIONS.md)
- Single-context repo — `CONTEXT.md` at root + `docs/adr/`. See `docs/agents/domain.md`.
- Issues live in GitHub Issues (`gh` CLI). See `docs/agents/issue-tracker.md`.
- Default five-label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.
- PR descriptions must follow `.github/PULL_REQUEST_TEMPLATE.md` exactly. End with a `🤖 Generated with [Claude Code](https://claude.com/claude-code)` footer, but no session link — the session link belongs in commit trailers only (`Claude-Session`).

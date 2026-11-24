# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Issue title**: one plain sentence saying what is true when the issue is done, such as "Coding rules live in one file and CI checks the mechanical ones". No `chore(...)` or `fix(...)` prefix: older issues have one, but PR titles and commits are the only place for conventional commits.
- **Issue body**: ends with a `## Done when` checklist a reviewer can check off. Use that heading, not "Acceptance criteria", since the `verify-meridiano-api` skill looks for it. An item that changes what `/api` returns names the request and the expected status or body, such as "`POST /api/notes/append` past 20,000 characters returns 400", so the skill can prove it against the running app. An issue with no API change, like the #403 refactor, lists the commands and checks that prove it. The review run sees the branch and the issue, never the PR body, so each item is a command, file or request it can check there. A number you want reported back, like #426's mutation score and wall time, goes in a `## Report in the PR body` section instead.
- **PR title**: name the class, file or folder that changed and where it went, so the squash commit reads cold in `git log`. #380 "refactor(rate-limit): move the rate limiter from src/auth to libs/rate-limit" does this. "helpers another module needs move out of auth, scraper and processor" (#382's first title) describes the rule behind the change, and nobody can grep for it. Leave minor test-only parts of the change to the body.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

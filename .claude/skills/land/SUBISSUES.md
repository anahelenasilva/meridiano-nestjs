Two ways an issue's parent relationship shows up. Check native first — it's authoritative. Fall back to the text convention only if native returns nothing, and only act on an unambiguous match.

## Native GitHub sub-issues

Query the issue's parent:

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        parent { number title state }
      }
    }
  }' -F owner=<owner> -F repo=<repo> -F number=<issue-number>
```

`parent: null` → not a sub-issue via this path; try the fallback below.

`parent` present → note its `number`, then check whether every one of *its* sub-issues is closed:

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        subIssuesSummary { total completed }
        subIssues(first: 100) { nodes { number title state } }
      }
    }
  }' -F owner=<owner> -F repo=<repo> -F number=<parent-number>
```

All closed when `subIssuesSummary.total == subIssuesSummary.completed`, equivalently every node in `subIssues.nodes` has `state == "CLOSED"`.

## Fallback: text convention

Older issues may predate the native feature. Check this issue's body/comments (`gh issue view <N> --json body,comments`) for an explicit parent reference — `Part of #N`, `Sub-issue of #N`, `Parent: #N`. If found, treat `#N` as the parent, then check *its* body for a task list referencing sibling issues (`- [ ] #<n>` / `- [x] #<n>`) instead of the GraphQL query above — every checkbox pointing at a real issue must be closed for the parent to be closable.

If neither path yields a clear parent, treat the issue as standalone. A weak or partial match — a stray `#N` in unrelated prose, a task list mixing issue links and plain TODOs — is not a match. Don't guess: report it as standalone.

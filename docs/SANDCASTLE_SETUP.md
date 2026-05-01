**Normal flow** (image already exists):

```bash
export ISSUE_NUMBER=70
export ISSUE_TITLE=$(gh issue view 70 --json title --jq '.title')
export BRANCH="sandcastle/issue-70-$(echo "$ISSUE_TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -dc '[:alnum:]-' | cut -c1-40)"
pnpm sandbox:implement
```

---

**When to rebuild** (`pnpm sandbox:build`):

- First time on new machine
- After editing `.sandcastle/Dockerfile`
- After `docker rmi sandcastle:meridiano-nestjs`
- Error: `Unable to find image 'sandcastle:meridiano-nestjs' locally`

---

**Common errors → fixes:**

| Error                                   | Fix                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Unable to find image`                  | `pnpm sandbox:build`                                                                                 |
| `Permission denied` on `.gitconfig`     | `docker rmi sandcastle:meridiano-nestjs` then `pnpm sandbox:build` (UID mismatch — never use `sudo`) |
| `Prompt argument has no matching value` | `export` the env vars before running                                                                 |
| `Container already exists`              | `docker rm -f $(docker ps -aq --filter name=sandcastle)`                                             |
| API credit error                        | Anthropic billing issue, unrelated to setup                                                          |

---

**Never use `sudo`** with any of these commands — it drops env vars and corrupts container ownership.

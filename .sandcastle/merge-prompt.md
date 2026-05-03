# TASK

Merge the following branch into the current branch:

`{{BRANCH}}`

1. Run `git merge {{BRANCH}} --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, run `pnpm run typecheck` and `pnpm run test` to verify everything works
4. If tests fail, fix the issues before proceeding

# CLOSE ISSUE

After the merge succeeds, close the issue. If `{{ISSUE_ID}}` is empty, skip this step and do not attempt to close anything.

`gh issue close {{ISSUE_ID}} --comment "Completed by Sandcastle and merged to main."`

Once you've merged (and closed the issue if applicable), output <promise>COMPLETE</promise>.

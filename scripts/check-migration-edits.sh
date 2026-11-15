#!/usr/bin/env bash
# Fails when a branch modifies, renames or deletes an existing migration. A
# migration that already ran is never rewritten by accident; new migrations
# pass.
#
#   pnpm lint:migrations [base-ref] [head-ref]
#
# base-ref defaults to origin/main and head-ref to HEAD.
#
# A deliberate edit (docs/DATABASE_MIGRATIONS.md, "Never edit a migration that
# already ran") gets the `migration-edit` PR label, which skips this check in
# PR Checks.
set -uo pipefail

base="${1:-origin/main}"
head="${2:-HEAD}"
migrations='src/database/migrations'

cd "$(dirname "$0")/.." || exit 1

# Three dots diff from the merge base, so commits that landed on the base
# after the branch started do not count as edits.
if ! changed="$(git diff --name-status --diff-filter=MRD "$base...$head" -- "$migrations")"; then
  echo "check-migration-edits: cannot diff $base...$head. In CI the checkout needs the base branch history." >&2
  exit 2
fi

if [ -n "$changed" ]; then
  echo "check-migration-edits: these existing migrations were modified (M), renamed (R) or deleted (D):" >&2
  echo "$changed" >&2
  echo "Add a new migration instead. For a deliberate edit, see docs/DATABASE_MIGRATIONS.md." >&2
  exit 1
fi
echo "check-migration-edits: ok"

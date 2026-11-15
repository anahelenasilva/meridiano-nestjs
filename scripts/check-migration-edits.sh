#!/usr/bin/env bash
# Fails when a branch modifies, renames or deletes an existing migration. A
# migration that already ran is never rewritten by accident; new migrations
# pass.
#
#   pnpm lint:migrations [base-ref] [head-ref]
#   bash scripts/check-migration-edits.sh --staged
#
# base-ref defaults to origin/main and head-ref to HEAD. --staged checks the
# staged changes instead, and is what .githooks/pre-commit runs.
#
# A deliberate edit (docs/DATABASE_MIGRATIONS.md, "Never edit a migration that
# already ran") gets the `migration-edit` PR label, which skips this check in
# PR Checks. Locally, commit it with --no-verify.
set -uo pipefail

migrations='src/database/migrations'

cd "$(dirname "$0")/.." || exit 1

if [ "${1:-}" = "--staged" ]; then
  range='--cached'
else
  # Three dots diff from the merge base, so commits that landed on the base
  # after the branch started do not count as edits.
  range="${1:-origin/main}...${2:-HEAD}"
fi

if ! changed="$(git diff --name-status --diff-filter=MRD "$range" -- "$migrations")"; then
  echo "check-migration-edits: cannot diff $range. In CI the checkout needs the base branch history." >&2
  exit 2
fi

if [ -n "$changed" ]; then
  echo "check-migration-edits: these existing migrations were modified (M), renamed (R) or deleted (D):" >&2
  echo "$changed" >&2
  echo "Add a new migration instead. For a deliberate edit, see docs/DATABASE_MIGRATIONS.md." >&2
  exit 1
fi
echo "check-migration-edits: ok"

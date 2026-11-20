#!/usr/bin/env bash
# Pre-commit check: fails when a staged file is over 5000 tokens, estimated as
# bytes / 4, and tells the agent how to split it. Runs from .githooks/pre-commit;
# run it by hand with:
#
#   bash scripts/check-staged-file-size.sh
#
# It measures the staged blob, not the working tree, so it judges exactly what
# the commit will contain. Binary files and the files in `skip` are never
# checked: generated files, and workflow files, which GitHub reads as one file
# each and which cannot be split.
set -uo pipefail

max_tokens=5000
max_bytes=$((max_tokens * 4))
skip='^(pnpm-lock\.yaml|openapi\.json|\.github/workflows/[^/]+\.yml)$'

cd "$(dirname "$0")/.." || exit 1

paths=()
# --numstat prints "-" as the added count for a binary file. --no-renames
# reports a rename as an add, so the new path gets checked.
while IFS=$'\t' read -r -d '' added _deleted path; do
  [ "$added" = "-" ] && continue
  [[ "$path" =~ $skip ]] && continue
  paths+=("$path")
done < <(git diff --cached --numstat --no-renames --diff-filter=ACM -z)

[ "${#paths[@]}" -eq 0 ] && exit 0

# One cat-file call for every size keeps a large commit fast. It prints the
# sizes in input order, so paste lines each one up with its path.
offenders="$(
  printf ':%s\n' "${paths[@]}" |
    git cat-file --batch-check='%(objectsize)' |
    paste - <(printf '%s\n' "${paths[@]}") |
    awk -F'\t' -v max="$max_bytes" \
      '$1 > max { printf "  %s: ~%d tokens (%d bytes)\n", $2, $1 / 4, $1 }'
)"

[ -z "$offenders" ] && exit 0

cat >&2 <<EOF
check-staged-file-size: these staged files are over $max_tokens tokens (bytes / 4):
$offenders

An agent cannot read a file this long in one pass, so split it before you
commit. Split by responsibility, so each new file has one reason to change and
ends well under the limit:

- A service: move each group of methods that shares a concern or a dependency
  into its own service in the same module, register it in the module and
  inject it. Move pure functions into a helpers/ file. Follow "Module Layout"
  in docs/CODING_STANDARDS.md, and give every new *.service.ts a sibling
  *.service.spec.ts (pnpm lint:layout checks this).
- A spec: when its service splits, move each describe block to the new
  service's spec. Otherwise keep <name>.spec.ts and move describe blocks into
  sibling <name>.<topic>.spec.ts files, with shared setup in a test-helpers.ts
  next to them (like src/articles/test-helpers.ts).
- A controller: move a group of routes into a second controller by resource.
- A doc: split by heading into linked files.

Do not get under the limit by deleting tests, comments or error handling, or by
minifying. Stage the new files and commit again.
EOF
exit 1

#!/usr/bin/env bash
# Mutation-tests source code with StrykerJS against the unit suite.
#
#   pnpm test:mutation <file>          mutates the whole file
#   pnpm test:mutation [--base <ref>]  mutates only the lines this branch
#                                      changed in src/ and libs/ since its
#                                      merge base with <ref> (default
#                                      origin/main), uncommitted edits and
#                                      untracked files included
#
# Reports land in reports/mutation/mutation.{html,json}. The command passes
# --mutate itself so stryker.config.mjs carries no mutate list.
# MUTATION_DRY_RUN=1 prints the --mutate value and exits before Stryker starts,
# so the command's tests check its arguments without a minutes-long run.
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

usage="Usage: pnpm test:mutation <file> | pnpm test:mutation [--base <ref>]"

base="origin/main"
base_given=""
files=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --base)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        echo "test:mutation: --base needs a git ref. $usage" >&2
        exit 2
      fi
      base="$2"
      base_given=1
      shift 2
      ;;
    --base=*)
      base="${1#--base=}"
      base_given=1
      shift
      ;;
    -*)
      echo "test:mutation: unknown option $1. $usage" >&2
      exit 2
      ;;
    *)
      files+=("$1")
      shift
      ;;
  esac
done

if [ "${#files[@]}" -gt 1 ]; then
  echo "test:mutation: expected one file, got ${#files[@]}. $usage" >&2
  exit 2
fi
if [ "${#files[@]}" -eq 1 ] && [ -n "$base_given" ]; then
  echo "test:mutation: --base only applies without a file, a file is mutated whole. $usage" >&2
  exit 2
fi

# Stryker gains nothing from these: specs and mocks are the tests themselves,
# modules and the bootstrap are decorator wiring, migrations and CLI scripts
# have no unit specs to kill their mutants.
is_mutable() {
  case "$1" in
    src/*.ts | libs/*.ts) ;;
    *) return 1 ;;
  esac
  case "$1" in
    *.spec.ts | *.module.ts | src/main.ts | */__mocks__/* | */migrations/* | src/scripts/*) return 1 ;;
  esac
  return 0
}

if [ "${#files[@]}" -eq 1 ]; then
  file="${files[0]}"
  if [ ! -f "$file" ]; then
    echo "test:mutation: no file at $file (paths are relative to the repo root)" >&2
    exit 2
  fi
  mutate="$file"
else
  # Fixed prefixes and no color so the parser below sees the same text
  # whatever the user's git config says.
  if ! diff_output="$(git diff -U0 --no-color --no-ext-diff --src-prefix=a/ --dst-prefix=b/ \
    --merge-base "$base" -- src libs 2>&1)"; then
    echo "test:mutation: cannot diff against $base; pass --base <ref> naming a branch or commit this one shares history with" >&2
    exit 1
  fi

  # Each "+start[,count]" hunk header becomes file:start-end. A missing count
  # means one line; count 0 is a pure deletion. Deleted files have
  # "+++ /dev/null" and only zero-count hunks. "+++" is read only between
  # "diff --git" and the first "@@", where an added line starting "++" can't be.
  ranges="$(printf '%s\n' "$diff_output" | awk '
    /^diff --git / { in_header = 1; file = ""; next }
    in_header && /^\+\+\+ / {
      file = ($0 == "+++ /dev/null") ? "" : substr($0, 7)
      next
    }
    /^@@ / {
      in_header = 0
      if (file == "") next
      split($3, added, ",")
      start = substr(added[1], 2) + 0
      count = (2 in added) ? added[2] + 0 : 1
      if (count == 0) next
      print file ":" start "-" (start + count - 1)
    }
  ')"
  untracked="$(git ls-files --others --exclude-standard -- src libs)"

  targets=()
  while IFS= read -r target; do
    [ -n "$target" ] || continue
    if is_mutable "${target%%:*}"; then
      targets+=("$target")
    fi
  done <<<"$ranges"$'\n'"$untracked"

  # Without a --mutate value Stryker falls back to its default glob and
  # mutates all of src, so stop here instead.
  if [ "${#targets[@]}" -eq 0 ]; then
    echo "test:mutation: no changed lines in src/ or libs/ to mutate"
    exit 0
  fi
  mutate="$(
    IFS=,
    echo "${targets[*]}"
  )"
fi

if [ -n "${MUTATION_DRY_RUN:-}" ]; then
  echo "$mutate"
  exit 0
fi

exec pnpm exec stryker run --mutate "$mutate"

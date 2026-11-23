#!/usr/bin/env bash
# Mutation-tests one source file with StrykerJS against the unit suite.
#
#   pnpm test:mutation <file>
#
# Reports land in reports/mutation/mutation.{html,json}. The command passes
# --mutate itself so stryker.config.json carries no mutate list.
# MUTATION_DRY_RUN=1 prints the --mutate value and exits before Stryker starts,
# so the command's tests check its arguments without a minutes-long run.
set -euo pipefail

cd "$(dirname "$0")/.." || exit 1

if [ "$#" -ne 1 ]; then
  echo "test-mutation: expected one file, got $#. Usage: pnpm test:mutation <file>" >&2
  exit 2
fi

file="$1"
if [ ! -f "$file" ]; then
  echo "test-mutation: no file at $file (paths are relative to the repo root)" >&2
  exit 2
fi

if [ -n "${MUTATION_DRY_RUN:-}" ]; then
  echo "$file"
  exit 0
fi

exec pnpm exec stryker run --mutate "$file"

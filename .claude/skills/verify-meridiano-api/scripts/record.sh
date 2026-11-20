#!/usr/bin/env bash
# Runs one command and records its output as evidence. It runs whatever it is
# given, so pass only read-only commands.
#
#   VERIFY_RUN=<dir> .claude/skills/verify-meridiano-api/scripts/record.sh <label> <command> [args...]
#
# For proof that is neither an HTTP response nor a SQL row, such as Redis keys
# (`redis-cli -n 9 --scan --pattern 'rate_limit:*'`) or log lines
# (`grep 'news-digest' "$VERIFY_RUN/server.log"`).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/_common.sh"
load_run

label="$1"; shift
file="$(next_evidence_file "$label")"
{
  echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "command: $*"
  "$@" 2>&1
  echo "exit: $?"
} | tee "$file"
echo "RECORD -> $file" >&2

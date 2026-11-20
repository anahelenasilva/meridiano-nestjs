#!/usr/bin/env bash
# Runs one read-only query against the dev DB and records it as evidence.
#
#   VERIFY_RUN=<dir> .claude/skills/verify-meridiano-api/scripts/sql.sh <label> "<select ...>"
#
# The session is read-only (default_transaction_read_only), so a write fails
# instead of touching Ana's data. Use it to prove side effects: rows a request
# inserted, updated or soft-deleted.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/_common.sh"
load_run

label="$1" query="$2"
db_user="$(read_dotenv "$CHECKOUT" DATABASE_USER)"
db_name="$(read_dotenv "$CHECKOUT" DATABASE_NAME)"
file="$(next_evidence_file "$label")"
{
  echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "query: $query"
  docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "$PG_CONTAINER" \
    psql -U "$db_user" -d "${db_name:-meridian}" -c "$query" 2>&1
} | tee "$file"
echo "SQL -> $file" >&2

# Sourced by the other helpers. Shared paths and the run-state loader.

STATE_ROOT="${TMPDIR:-/tmp}/verify-meridiano-api"
EVIDENCE_ROOT="${VERIFY_EVIDENCE_ROOT:-$HOME/Desktop/dev/.scratch/verify-meridiano-api}"
REDIS_DB=9
REDIS_MARKER='verify-meridiano-api:owner'
PG_CONTAINER='meridiano-postgres-local'

# Loads $VERIFY_RUN/env (CHECKOUT, PORT, BASE_URL, PID, LOG, EVIDENCE, SHA).
load_run() {
  if [ -z "${VERIFY_RUN:-}" ] || [ ! -f "$VERIFY_RUN/env" ]; then
    echo "VERIFY_RUN is unset or has no env file. Prefix the command with the VERIFY_RUN=... line launch.sh printed." >&2
    exit 2
  fi
  # shellcheck disable=SC1091
  . "$VERIFY_RUN/env"
}

# Prints the next numbered evidence path for label $1, e.g. 007-notes-save.txt.
next_evidence_file() {
  local n
  n="$(find "$EVIDENCE" -maxdepth 1 -name '[0-9][0-9][0-9]-*.txt' | wc -l | tr -d ' ')"
  echo "$EVIDENCE/$(printf '%03d' "$((n + 1))")-$1.txt"
}

read_dotenv() { grep -E "^$2=" "$1/.env" | head -1 | cut -d= -f2- ; }

# Prints migration timestamps that exist as files in $1 but not in the dev DB.
pending_migrations() {
  local checkout="$1" db_user db_name applied
  db_user="$(read_dotenv "$checkout" DATABASE_USER)"
  db_name="$(read_dotenv "$checkout" DATABASE_NAME)"
  applied="$(docker exec "$PG_CONTAINER" psql -U "$db_user" -d "${db_name:-meridian}" -Atc 'select timestamp from typeorm_migrations')"
  for f in "$checkout"/src/database/migrations/*.ts; do
    ts="$(basename "$f" | sed -E 's/^([0-9]+)-.*/\1/')"
    printf '%s\n' "$applied" | grep -qx "$ts" || echo "$ts $(basename "$f")"
  done
}

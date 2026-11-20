#!/usr/bin/env bash
# Stops the verify instance this run started and clears its scratch state.
#
#   VERIFY_RUN=<dir> .claude/skills/verify-meridiano-api/scripts/cleanup.sh
#
# Kills only the process group launch.sh recorded, copies server.log into the
# evidence dir, flushes Redis db 9 only while it carries this run's marker,
# then deletes the run's state files. The evidence dir is never touched.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/_common.sh"
load_run

if kill -0 "$PID" 2>/dev/null; then
  kill -- -"$PID" 2>/dev/null
  for _ in $(seq 15); do kill -0 "$PID" 2>/dev/null || break; sleep 1; done
  kill -0 "$PID" 2>/dev/null && kill -9 -- -"$PID" 2>/dev/null
fi
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "cleanup: port $PORT still has a listener, check it by hand" >&2
fi

[ -f "$LOG" ] && cp "$LOG" "$EVIDENCE/server.log"

if [ "$(redis-cli -n "$REDIS_DB" get "$REDIS_MARKER")" = "$VERIFY_RUN" ]; then
  redis-cli -n "$REDIS_DB" flushdb >/dev/null
fi

for f in env pid token last-body server.log; do rm -f "$VERIFY_RUN/$f"; done
for f in "$VERIFY_RUN"/*.json; do [ -f "$f" ] && rm -f "$f"; done
rmdir "$VERIFY_RUN" 2>/dev/null || echo "cleanup: $VERIFY_RUN kept, it holds files this skill did not write" >&2

echo "cleanup: stopped $PID, evidence kept in $EVIDENCE"

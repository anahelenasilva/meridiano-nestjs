#!/usr/bin/env bash
# Read-only answer to "is this verify instance worth driving?".
#
#   VERIFY_RUN=<dir> .claude/skills/verify-meridiano-api/scripts/doctor.sh
#
# Prints one ok/FAIL line per check and exits 1 on any FAIL.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/_common.sh"
load_run

fail=0
check() { if [ "$2" = ok ]; then echo "ok    $1"; else echo "FAIL  $1: $2"; fail=1; fi; }

if kill -0 "$PID" 2>/dev/null; then check "server process $PID alive" ok; else check "server process $PID alive" "not running"; fi

listener="$(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1)"
if [ -n "$listener" ] && [ "$(ps -o pgid= -p "$listener" | tr -d ' ')" = "$PID" ]; then
  check "port $PORT owned by this run's process group" ok
else
  check "port $PORT owned by this run's process group" "listener pid '${listener:-none}' is not in group $PID"
fi

code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/health")"
[ "$code" = 200 ] && check "GET /api/health" ok || check "GET /api/health" "HTTP $code"

head_sha="$(git -C "$CHECKOUT" rev-parse --short HEAD)"
dirty="$(git -C "$CHECKOUT" status --porcelain -- src libs | head -1)"
if [ "$head_sha" = "$SHA" ] && [ -z "$dirty" ]; then
  check "build matches checkout HEAD $SHA" ok
else
  check "build matches checkout HEAD $SHA" "HEAD is $head_sha${dirty:+, src/libs have uncommitted edits}; nest start does not watch, so relaunch to pick them up"
fi

if [ "$(redis-cli -n "$REDIS_DB" get "$REDIS_MARKER")" = "$VERIFY_RUN" ] &&
  redis-cli -n "$REDIS_DB" --scan --pattern 'bull:*' | head -1 | grep -q .; then
  check "queues live in Redis db $REDIS_DB" ok
else
  check "queues live in Redis db $REDIS_DB" "marker or bull:* keys missing in db $REDIS_DB"
fi

if [ -s "$VERIFY_RUN/token" ]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $(cat "$VERIFY_RUN/token")" "$BASE_URL/api/ask/models")"
  [ "$code" = 200 ] && check "verify user token accepted" ok || check "verify user token accepted" "HTTP $code, rerun login.sh"
else
  echo "info  no token yet, run login.sh"
fi

pending="$(pending_migrations "$CHECKOUT")"
[ -z "$pending" ] && check "dev DB has every migration in the checkout" ok || check "dev DB has every migration in the checkout" "$pending"

exit "$fail"

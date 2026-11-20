#!/usr/bin/env bash
# Starts one API instance for verification and leaves it running.
#
#   .claude/skills/verify-meridiano-api/scripts/launch.sh [checkout]
#
# checkout defaults to the current git toplevel (a worktree works, with .env
# linked from the main checkout). Prints a VERIFY_RUN=... line: prefix every
# other helper with it. Refuses when another verify instance is alive, when
# Redis db 9 holds keys this skill did not create, or when the checkout has
# migrations the dev DB lacks (boot would apply them; set
# VERIFY_ALLOW_MIGRATIONS=1 only after Ana agrees).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/_common.sh"

checkout="$(cd "${1:-$(git rev-parse --show-toplevel)}" && pwd)" || exit 1
[ -e "$checkout/.env" ] || { echo "launch: no .env in $checkout. In a worktree: ln -s <main checkout>/.env $checkout/.env" >&2; exit 1; }

mkdir -p "$STATE_ROOT"
for pidfile in "$STATE_ROOT"/*/pid; do
  [ -f "$pidfile" ] || continue
  if kill -0 "$(cat "$pidfile")" 2>/dev/null; then
    echo "launch: a verify instance is already running. Reuse it or clean it up:" >&2
    echo "VERIFY_RUN=$(dirname "$pidfile")" >&2
    exit 1
  fi
done

keys="$(redis-cli -n "$REDIS_DB" dbsize)"
if [ "$keys" != "0" ] && [ -z "$(redis-cli -n "$REDIS_DB" get "$REDIS_MARKER")" ]; then
  echo "launch: Redis db $REDIS_DB holds $keys keys this skill did not create. Ask Ana before using it." >&2
  exit 1
fi

pending="$(pending_migrations "$checkout")"
if [ -n "$pending" ] && [ "${VERIFY_ALLOW_MIGRATIONS:-}" != 1 ]; then
  echo "launch: booting would apply these migrations to the dev DB:" >&2
  echo "$pending" >&2
  echo "Ask Ana, then rerun with VERIFY_ALLOW_MIGRATIONS=1." >&2
  exit 1
fi

sha="$(git -C "$checkout" rev-parse --short HEAD)"
run_id="$(date +%Y%m%d-%H%M%S)-$sha"
run="$STATE_ROOT/$run_id"
evidence="$EVIDENCE_ROOT/$run_id"
mkdir -p "$run" "$evidence"
port="$(node -e "const s=require('net').createServer().listen(0,()=>{process.stdout.write(String(s.address().port));s.close()})")"
log="$run/server.log"

redis-cli -n "$REDIS_DB" set "$REDIS_MARKER" "$run" >/dev/null

# Job control gives the server its own process group, so cleanup's one kill
# reaches npx, nest and the node child. REDIS_URL wins over REDIS_HOST in
# libs/redis/redis.service.ts, so queues and rate-limit counters stay in db 9.
set -m
(cd "$checkout" && PORT="$port" REDIS_URL="redis://127.0.0.1:6379/$REDIS_DB" exec nohup npx nest start) >"$log" 2>&1 &
pid=$!
set +m
echo "$pid" >"$run/pid"

cat >"$run/env" <<EOF
CHECKOUT=$checkout
PORT=$port
BASE_URL=http://127.0.0.1:$port
PID=$pid
LOG=$log
EVIDENCE=$evidence
SHA=$sha
EOF

timeout="${VERIFY_BOOT_TIMEOUT:-180}"
for _ in $(seq "$timeout"); do
  if grep -q 'Meridiano API server running' "$log" &&
    [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/health")" = 200 ]; then
    echo "launch: $checkout ($sha) ready on http://127.0.0.1:$port, evidence in $evidence"
    echo "VERIFY_RUN=$run"
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "launch: server exited before ready. Last log lines:" >&2
    tail -n 40 "$log" >&2
    echo "Run cleanup: VERIFY_RUN=$run $here/cleanup.sh" >&2
    exit 1
  fi
  sleep 1
done
echo "launch: not ready within ${timeout}s. Last log lines:" >&2
tail -n 40 "$log" >&2
echo "Run cleanup: VERIFY_RUN=$run $here/cleanup.sh" >&2
exit 1

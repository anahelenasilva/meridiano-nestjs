#!/usr/bin/env bash
# Boots the API once and reports whether it reached the ready line.
#
#   pnpm check:boot [dir]    dir defaults to this checkout
#
# Runs on a free port so a worktree and the main checkout can boot side by
# side, and kills the server on every exit path: pass, fail, timeout, Ctrl+C.
# BOOT_TIMEOUT overrides the 120s limit, which covers the `nest start` build.
set -uo pipefail

dir="$(cd "${1:-.}" && pwd)" || exit 1
timeout="${BOOT_TIMEOUT:-120}"
ready='Meridiano API server running'

if [ ! -e "$dir/.env" ]; then
  echo "boot-check: no .env in $dir. In a worktree: ln -s <main checkout>/.env $dir/.env" >&2
  exit 1
fi

port="$(node -e "const s = require('net').createServer().listen(0, () => { process.stdout.write(String(s.address().port)); s.close(); })")"
log="$(mktemp "${TMPDIR:-/tmp}/boot-check.XXXXXX")"

# Job control gives the server its own process group, so one kill reaches
# npx, nest and the node child.
set -m
(cd "$dir" && PORT="$port" exec npx nest start) >"$log" 2>&1 &
pid=$!

cleanup() {
  kill -- -"$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  rm -f "$log"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

for _ in $(seq "$timeout"); do
  if grep -q "$ready" "$log"; then
    echo "boot-check: $dir booted on port $port"
    exit 0
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "boot-check: $dir exited before the ready line" >&2
    tail -n 40 "$log" >&2
    exit 1
  fi
  sleep 1
done

echo "boot-check: $dir did not boot within ${timeout}s" >&2
tail -n 40 "$log" >&2
exit 1

#!/usr/bin/env bash
#
# Deploys the newest commit on origin/main to the Pi.
#
# The Pi reaches out to GitHub; nothing on the internet reaches the Pi. Run by
# meridiano-deploy.timer, or by hand over Tailscale for an immediate deploy.
# Exits 0 and does nothing when origin/main has not moved.
#
# Runs as root so it can restart the unit and write backups, but every git and
# pnpm call drops to APP_USER. Running those as root leaves root-owned files in
# the checkout that break the next deploy.
set -euo pipefail

REPO="${REPO:-/home/anahelena/dev/meridiano-nestjs}"
APP_USER="${APP_USER:-anahelena}"
SERVICE="${SERVICE:-meridiano}"
BRANCH="${BRANCH:-main}"
PNPM="${PNPM:-/usr/bin/pnpm}"
ENV_FILE="${ENV_FILE:-$REPO/.env}"
PG_CONTAINER="${PG_CONTAINER:-meridiano-postgres-production}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/meridiano}"
BACKUP_KEEP="${BACKUP_KEEP:-10}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
# A commit that failed to deploy is recorded here so the timer does not rebuild
# and restart it every two minutes until someone notices.
STATE_DIR="${STATE_DIR:-/var/lib/meridiano}"
FAILED_FILE="$STATE_DIR/failed-sha"

log() { echo "[$(date -Is)] $*"; }

as_app() { sudo -u "$APP_USER" -H "$@"; }

git_app() { as_app git -C "$REPO" "$@"; }

# Reads one KEY=value out of the env file without executing it. Sourcing a .env
# as root would run any command hiding in an unquoted value.
env_value() {
  { grep -E "^[[:space:]]*(export[[:space:]]+)?$1=" "$ENV_FILE" || true; } \
    | tail -n1 \
    | sed -e "s/^[^=]*=//" -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# Only tracked changes block a deploy. Untracked files in the checkout are left
# alone, and nothing here ever runs git clean.
tracked_changes() {
  git_app status --porcelain --untracked-files=no
}

# Aborts the deploy if it fails. Auto-rollback reverts code and not the schema,
# so this dump is the only way back from a migration that destroys data.
backup_database() {
  local out url
  mkdir -p "$BACKUP_DIR"
  out="$BACKUP_DIR/meridiano-$(date +%Y%m%d-%H%M%S).sql.gz"

  url="$(env_value DATABASE_URL)"
  if [ -z "$url" ]; then
    log "DATABASE_URL is not set in $ENV_FILE, refusing to deploy without a backup"
    return 1
  fi

  # Dumps from inside the database container, so the client version always
  # matches the server and there is no network name to get wrong. The host in
  # DATABASE_URL is how the app reaches postgres from outside; in here it is
  # always localhost.
  docker exec -i "$PG_CONTAINER" \
    pg_dump "$(printf '%s' "$url" | sed -E 's#@[^/]+/#@localhost:5432/#')" \
    | gzip >"$out"

  log "database backed up to $out ($(du -h "$out" | cut -f1))"
  # SC2012: ls is fine here, the names are timestamps we generate, and sorting
  # by mtime is the whole point.
  # shellcheck disable=SC2012
  ls -1t "$BACKUP_DIR"/meridiano-*.sql.gz | tail -n "+$((BACKUP_KEEP + 1))" | xargs -r rm -f
}

# Explicit `|| return 1` on every step: bash suppresses errexit inside a
# function called as a condition, so set -e alone would not stop the build here.
checkout_and_build() {
  git_app reset --hard --quiet "$1" || return 1
  as_app "$PNPM" install --frozen-lockfile || return 1
  as_app "$PNPM" run build || return 1
}

wait_for_health() {
  local port url deadline
  port="$(env_value PORT)"
  url="http://127.0.0.1:${port:-3001}/api/health"
  deadline=$(($(date +%s) + HEALTH_TIMEOUT))

  while [ "$(date +%s)" -lt "$deadline" ]; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done

  log "no healthy response from $url within ${HEALTH_TIMEOUT}s"
  return 1
}

rollback_to() {
  local old="$1"
  log "ROLLBACK: rebuilding ${old:0:12}"
  if checkout_and_build "$old"; then
    systemctl restart "$SERVICE"
    if wait_for_health; then
      log "ROLLBACK succeeded, running ${old:0:12}"
      return 0
    fi
  fi
  log "ROLLBACK FAILED, $SERVICE needs hands"
  return 1
}

main() {
  cd "$REPO"
  mkdir -p "$STATE_DIR"

  if [ -n "$(tracked_changes)" ]; then
    log "tracked files are modified in $REPO, refusing to reset over them:"
    tracked_changes
    return 1
  fi

  git_app fetch --quiet origin "$BRANCH"

  local old new
  old="$(git_app rev-parse HEAD)"
  new="$(git_app rev-parse "origin/$BRANCH")"

  if [ "$old" = "$new" ]; then
    log "already on ${new:0:12}, nothing to do"
    return 0
  fi

  if [ -f "$FAILED_FILE" ] && [ "$(cat "$FAILED_FILE")" = "$new" ]; then
    log "${new:0:12} already failed to deploy, waiting for a newer commit"
    log "to retry it anyway: rm $FAILED_FILE"
    return 0
  fi

  log "deploying ${old:0:12} -> ${new:0:12}"
  backup_database

  # The running process keeps serving from memory through the build and the
  # migration. Only the restart below is downtime.
  if checkout_and_build "$new" && as_app "$PNPM" run migration:run; then
    systemctl restart "$SERVICE"
    if wait_for_health; then
      rm -f "$FAILED_FILE"
      log "deploy healthy on ${new:0:12}"
      return 0
    fi
    journalctl -u "$SERVICE" -n 50 --no-pager || true
  fi

  echo "$new" >"$FAILED_FILE"
  rollback_to "$old"
  return 1
}

main "$@"

#!/usr/bin/env bash
#
# Deploys the newest backend image published to GHCR by .github/workflows/deploy.yml.
#
# The Pi reaches out to GHCR; nothing on the internet reaches the Pi. Run on a
# timer (see meridiano-deploy.timer) or by hand over Tailscale for an immediate
# deploy. Exits 0 and does nothing when the published image has not changed.
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/meridiano/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-/opt/meridiano/.env}"
SERVICE="${SERVICE:-meridian-backend}"
IMAGE="${IMAGE:-ghcr.io/anahelenasilva/meridiano-nestjs}"
IMAGE_TAG="${IMAGE_TAG:-main}"
DB_NETWORK="${DB_NETWORK:-meridiano-network-production}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/meridiano}"
BACKUP_KEEP="${BACKUP_KEEP:-10}"
# The compose healthcheck runs every 30s with 3 retries, so a slow boot plus a
# migration can legitimately take well over a minute to report healthy.
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-240}"
PG_CLIENT_IMAGE="${PG_CLIENT_IMAGE:-postgres:16-alpine}"

log() { echo "[$(date -Is)] $*"; }

compose() { docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"; }

running_image_id() {
  docker inspect -f '{{.Image}}' "$SERVICE" 2>/dev/null || true
}

image_revision() {
  docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$1" 2>/dev/null || true
}

# Aborts the deploy if it fails. A database we cannot reach is a database we
# cannot safely migrate, and this is the only environment there is.
backup_database() {
  local out
  mkdir -p "$BACKUP_DIR"
  out="$BACKUP_DIR/meridiano-$(date +%Y%m%d-%H%M%S).sql.gz"

  docker run --rm --network "$DB_NETWORK" \
    -e PGPASSWORD="$DATABASE_PASSWORD" \
    "$PG_CLIENT_IMAGE" \
    pg_dump -h "$DATABASE_HOST" -p "${DATABASE_PORT:-5432}" \
    -U "$DATABASE_USER" -d "$DATABASE_NAME" \
    | gzip >"$out"

  log "database backed up to $out ($(du -h "$out" | cut -f1))"
  # SC2012: ls is fine here, the names are timestamps we generate, and sorting
  # by mtime is the whole point.
  # shellcheck disable=SC2012
  ls -1t "$BACKUP_DIR"/meridiano-*.sql.gz | tail -n "+$((BACKUP_KEEP + 1))" | xargs -r rm -f
}

wait_for_health() {
  local deadline=$(($(date +%s) + HEALTH_TIMEOUT))
  local status
  while [ "$(date +%s)" -lt "$deadline" ]; do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$SERVICE" 2>/dev/null || echo missing)"
    case "$status" in
      healthy) return 0 ;;
      unhealthy)
        log "container reported unhealthy"
        return 1
        ;;
    esac
    sleep 5
  done
  log "container never became healthy within ${HEALTH_TIMEOUT}s"
  return 1
}

# Re-tags the previously running image locally so compose can bring it back. The
# old image is still on disk because pulling a new one does not evict it.
rollback_to() {
  local previous="$1"
  local bad_tag="$2"
  log "ROLLBACK: restoring ${previous}"
  docker tag "$previous" "$IMAGE:rollback"
  export IMAGE_TAG=rollback
  compose up -d "$SERVICE"
  if wait_for_health; then
    log "ROLLBACK succeeded; the bad build is still tagged $IMAGE:$bad_tag"
  else
    log "ROLLBACK FAILED; $SERVICE is down and needs hands"
  fi
}

main() {
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  # Sourcing the env file can redefine IMAGE_TAG. Export the winner so compose
  # resolves the same tag this script goes on to inspect.
  export IMAGE_TAG="${IMAGE_TAG:-main}"

  local before after
  before="$(running_image_id)"

  compose pull --quiet "$SERVICE"
  after="$(docker image inspect -f '{{.Id}}' "$IMAGE:$IMAGE_TAG")"

  if [ "$before" = "$after" ]; then
    log "already running $IMAGE:$IMAGE_TAG, nothing to do"
    return 0
  fi

  log "deploying $IMAGE:$IMAGE_TAG at revision $(image_revision "$after")"
  backup_database

  compose up -d "$SERVICE"

  if wait_for_health; then
    log "deploy healthy"
    return 0
  fi

  compose logs --tail 50 "$SERVICE" || true

  if [ -z "$before" ]; then
    log "no previous image to roll back to; $SERVICE is down and needs hands"
    return 1
  fi

  rollback_to "$before" "$IMAGE_TAG"
  return 1
}

main "$@"

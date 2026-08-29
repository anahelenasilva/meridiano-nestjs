# Deploying the API to the Raspberry Pi

Pushing to `main` publishes an arm64 image to GHCR. The Pi checks GHCR every two
minutes and deploys the image if the digest changed. Nothing on the internet
reaches the Pi: no forwarded ports, no tunnel, and GitHub holds no credential for
anything of yours. The Pi does all the reaching out.

Only `meridian-backend` deploys this way. Redis, Postgres, Node-RED, and the
frontend are untouched.

## What runs where

| Piece | Where | What it does |
| --- | --- | --- |
| `.github/workflows/deploy.yml` | GitHub | Lints, tests, then builds and pushes `ghcr.io/anahelenasilva/meridiano-nestjs` tagged `main` and the commit sha |
| `deploy.sh` | Pi, `/opt/meridiano/deploy.sh` | Pulls, backs up Postgres, restarts the backend, rolls back if it does not come up healthy |
| `meridiano-deploy.timer` | Pi, systemd | Runs `deploy.sh` every two minutes |

Migrations run inside the container at boot, ahead of `start:prod`. A failed
migration exits non-zero, the container never reports healthy, and `deploy.sh`
puts the previous image back.

## One time setup on the Pi

Make the GHCR package public once, under the repo's Packages tab, so the Pi pulls
without storing any credential. The repo is already public, so this exposes
nothing new.

Install the script and units:

```sh
sudo install -m 755 deploy/deploy.sh /opt/meridiano/deploy.sh
sudo install -m 644 deploy/meridiano-deploy.service /etc/systemd/system/
sudo install -m 644 deploy/meridiano-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

`/opt/meridiano/docker-compose.prod.yml` and `/opt/meridiano/.env` need to be the
files the Pi already runs. `.env` needs `DATABASE_HOST`, `DATABASE_PORT`,
`DATABASE_USER`, `DATABASE_PASSWORD`, and `DATABASE_NAME` for the backup step, and
`CORS_ORIGINS` set to the Tailscale host the frontend is served from. The compose
file still defaults `CORS_ORIGINS` to the old VPS IP when nothing overrides it.

Do the first deploy by hand and watch it:

```sh
sudo /opt/meridiano/deploy.sh
```

Then start the timer:

```sh
sudo systemctl enable --now meridiano-deploy.timer
```

## Day to day

Watch a deploy as it happens:

```sh
journalctl -u meridiano-deploy.service -f
```

Deploy immediately instead of waiting for the timer:

```sh
sudo systemctl start meridiano-deploy.service
```

Roll back to a specific commit, which survives the timer because the tag is
pinned:

```sh
cd /opt/meridiano
IMAGE_TAG=<commit-sha> docker compose -f docker-compose.prod.yml up -d meridian-backend
```

To go back to tracking `main`, drop `IMAGE_TAG` and run `deploy.sh` again.

Backups land in `/var/backups/meridiano`, gzipped, ten deep. Restore one with:

```sh
gunzip -c /var/backups/meridiano/meridiano-<timestamp>.sql.gz \
  | docker run --rm -i --network meridian-network -e PGPASSWORD="$DATABASE_PASSWORD" \
    postgres:17-alpine psql -h "$DATABASE_HOST" -U "$DATABASE_USER" -d "$DATABASE_NAME"
```

Stop automatic deploys with `sudo systemctl disable --now meridiano-deploy.timer`.
Everything keeps running, it just stops picking up new images.

## Knobs

`deploy.sh` reads these from the environment, and the service file is the place to
set them. Defaults are in the script's header.

`COMPOSE_FILE`, `ENV_FILE`, `SERVICE`, `IMAGE`, `IMAGE_TAG`, `DB_NETWORK`,
`BACKUP_DIR`, `BACKUP_KEEP`, `HEALTH_TIMEOUT`, `PG_CLIENT_IMAGE`.

`PG_CLIENT_IMAGE` needs to be at least the major version of the Postgres running
on the Pi. `pg_dump` refuses to dump a server newer than itself.

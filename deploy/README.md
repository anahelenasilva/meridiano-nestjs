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

## First, publish an image

The GHCR package does not exist until the workflow runs, so merge to main and let
it finish before touching the Pi.

Then make the package public, once. GHCR packages are private by default even
when the repo is public, and a private package means the Pi has to hold a token
with `read:packages` and rotate it. Public means the Pi pulls with no credential
at all, which is the point of the whole design. The image ships only `dist`, the
manifests, `libs/database`, and `scripts`, so no env file rides along.

Find it on the repo's Packages sidebar or at `github.com/users/anahelenasilva/packages`,
then Package settings, Change visibility, Public.

## Then set up the Pi

Install the script and units:

```sh
sudo install -m 755 deploy/deploy.sh /opt/meridiano/deploy.sh
sudo install -m 644 deploy/meridiano-deploy.service /etc/systemd/system/
sudo install -m 644 deploy/meridiano-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

`/opt/meridiano/docker-compose.prod.yml` and `/opt/meridiano/.env` need to be the
files the Pi already runs. `.env` needs `DATABASE_HOST`, `DATABASE_PORT`,
`DATABASE_USER`, `DATABASE_PASSWORD`, and `DATABASE_NAME`, which the backup step
reads.

`CORS_ORIGINS` is optional. Left empty, the API accepts any origin, which is a
reasonable default on a private tailnet. To lock it down, set it to the origin the
browser shows when you load the frontend: scheme, host, and port, no path and no
trailing slash. `http://pi.tailnet-name.ts.net` and `http://100.x.y.z` are
different origins to a browser, so list both if you reach the Pi either way.

```
CORS_ORIGINS=http://pi-name.tailnet-name.ts.net,http://100.x.y.z
```

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
  | docker run --rm -i --network meridiano-network-production -e PGPASSWORD="$DATABASE_PASSWORD" \
    postgres:16-alpine psql -h "$DATABASE_HOST" -U "$DATABASE_USER" -d "$DATABASE_NAME"
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

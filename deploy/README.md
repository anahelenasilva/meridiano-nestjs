# Deploying the API to the Raspberry Pi

The Pi checks `origin/main` every two minutes. When it moves, the Pi backs up
Postgres, pulls, builds, migrates, and restarts `meridiano.service`. If the API
does not come back healthy, the previous commit gets rebuilt and restarted.

Nothing on the internet reaches the Pi. No forwarded port, no tunnel, no
credential in either direction. The Pi does all the reaching out, and a public
repo needs no authentication to fetch.

Only the API deploys this way. `meridiano-frontend.service`, Postgres, and Redis
are untouched.

## What runs where

| Piece | Where | What it does |
| --- | --- | --- |
| `deploy.sh` | `/usr/local/bin/meridiano-deploy` | Fetch, back up, build, migrate, restart, roll back on failure |
| `meridiano-deploy.timer` | systemd | Runs the script every two minutes |
| `meridiano.service` | systemd | The API itself, `pnpm run start:prod` as `anahelena` |

The script runs as root so it can restart the unit and write to `/var/backups`.
Every `git` and `pnpm` call drops to `anahelena` with `sudo -u`. Running those as
root would leave root-owned files in the checkout and break the next deploy.

## Setup

```sh
sudo install -m 755 deploy/deploy.sh /usr/local/bin/meridiano-deploy
sudo install -m 644 deploy/meridiano-deploy.service /etc/systemd/system/
sudo install -m 644 deploy/meridiano-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

Run it by hand first and watch the whole thing:

```sh
sudo /usr/local/bin/meridiano-deploy
```

Then start the timer:

```sh
sudo systemctl enable --now meridiano-deploy.timer
systemctl list-timers meridiano-deploy.timer
```

Nothing else needs configuring. The script's defaults already match this Pi:
the checkout at `/home/anahelena/dev/meridiano-nestjs`, the `anahelena` user,
`meridiano.service`, and `meridiano-network-production` for the backup container.

Database credentials come from `.env` in the checkout, which the script reads one
key at a time rather than sourcing. Sourcing a `.env` as root would execute any
command hiding in an unquoted value.

`CORS_ORIGINS` lives in `meridiano.service`, not in `.env`. Change it with
`sudo systemctl edit --full meridiano` if the frontend ever moves.

## Day to day

Watch a deploy:

```sh
journalctl -u meridiano-deploy.service -f
```

Deploy now instead of waiting for the timer:

```sh
sudo systemctl start meridiano-deploy.service
```

Roll back to any commit by hand:

```sh
cd /home/anahelena/dev/meridiano-nestjs
git reset --hard <sha> && pnpm install --frozen-lockfile && pnpm run build
sudo systemctl restart meridiano
```

The timer will pull it forward to `origin/main` again within two minutes, so
revert on GitHub if you want the rollback to stick.

## When a deploy fails

The script writes the failing commit to `/var/lib/meridiano/failed-sha` and
refuses to try it again until `origin/main` moves to something else. Without
that, a commit that crashes on boot would rebuild and restart every two minutes
forever, taking a `pg_dump` each time.

So a failed deploy leaves you on the previous commit, with the Pi idle, waiting
for you to push a fix. To force a retry of the same commit:

```sh
sudo rm /var/lib/meridiano/failed-sha
```

The script also refuses to run at all when tracked files are modified in the
checkout, rather than resetting over your work. Untracked files are never
touched and `git clean` is never called, so `.env-bkp`, `get-docker.sh`, and
`transcripts/` are safe.

## Backups

Every deploy that has something to deploy dumps Postgres to
`/var/backups/meridiano/meridiano-<timestamp>.sql.gz` first, keeping the ten most
recent. The dump runs in a throwaway `postgres:16-alpine` container on
`meridiano-network-production`, so the Pi needs no Postgres client installed.

This exists because auto-rollback reverts code and not the schema. A migration
that runs and then fails its health check leaves you on old code against a new
schema, and if that migration dropped a column, the dump is the only way back.

Restore one with:

```sh
gunzip -c /var/backups/meridiano/meridiano-<timestamp>.sql.gz \
  | docker run --rm -i --network meridiano-network-production \
    -e PGPASSWORD="$DATABASE_PASSWORD" postgres:16-alpine \
    psql -h "$DATABASE_HOST" -U "$DATABASE_USER" -d "$DATABASE_NAME"
```

The dumps sit on the same Pi as the database, so they survive a bad migration but
not a dead SD card. Copying them off is a separate job that does not exist yet.

## Known trade-offs

Rollback rebuilds from source, so a failed deploy means a few minutes of running
the old code before it is restored, rather than a few seconds. A releases
directory with a `current` symlink would make rollback instant, at the cost of
more machinery than this deserves right now.

`pnpm run build` rewrites `dist/` while the old process is still running. Node
loaded its code at boot, so this is almost always fine, but a module that gets
required lazily could in principle hit a half-written file in the window between
the build and the restart.

The Pi deploys whatever is on `origin/main` without checking whether CI passed.
Pull requests are gated by `pr-checks.yml`, so this only matters for direct
pushes to main. Auto-rollback and the backup are the safety net there.

## Knobs

Set any of these in `meridiano-deploy.service`. Defaults are in the script header.

`REPO`, `APP_USER`, `SERVICE`, `BRANCH`, `PNPM`, `ENV_FILE`, `DB_NETWORK`,
`PG_CLIENT_IMAGE`, `BACKUP_DIR`, `BACKUP_KEEP`, `HEALTH_TIMEOUT`, `STATE_DIR`.

`PG_CLIENT_IMAGE` must be at least the major version of the Postgres on the Pi,
currently 16. `pg_dump` refuses to dump a server newer than itself.

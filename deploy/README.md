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

Pull the files straight out of `origin/main` without moving the checkout. Do
not `git pull` first: that makes `HEAD` equal `origin/main`, and the script would
then report "nothing to do" and skip the build entirely.

```sh
cd /home/anahelena/dev/meridiano-nestjs
git fetch origin main

git show origin/main:deploy/deploy.sh | sudo tee /usr/local/bin/meridiano-deploy >/dev/null
sudo chmod 755 /usr/local/bin/meridiano-deploy
git show origin/main:deploy/meridiano-deploy.service | sudo tee /etc/systemd/system/meridiano-deploy.service >/dev/null
git show origin/main:deploy/meridiano-deploy.timer | sudo tee /etc/systemd/system/meridiano-deploy.timer >/dev/null
sudo systemctl daemon-reload
```

These installed copies do not self-update. A deploy updates the checkout, so a
later change to `deploy/deploy.sh` or either unit lands in
`/home/anahelena/dev/meridiano-nestjs/deploy/` and sits there until you rerun the
block above. Run `sudo systemctl daemon-reload` again after any unit change.

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
`meridiano.service`, and `meridiano-postgres-production` for the backup.

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
recent. It runs `pg_dump` inside `meridiano-postgres-production` itself, so the
client version always matches the server and there is no network name to resolve.

The connection string comes from `DATABASE_URL` in `.env`, with its host rewritten
to `localhost` because inside that container localhost is the server. Credentials
and any percent-encoding pass through untouched. A missing `DATABASE_URL` aborts
the deploy rather than proceeding without a backup.

This exists because auto-rollback reverts code and not the schema. A migration
that runs and then fails its health check leaves you on old code against a new
schema, and if that migration dropped a column, the dump is the only way back.

Restore one with:

```sh
URL=$(grep -E '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=' \
  /home/anahelena/dev/meridiano-nestjs/.env \
  | sed -e 's/^[^=]*=//' -e 's#@[^/]*/#@localhost:5432/#')

gunzip -c /var/backups/meridiano/meridiano-<timestamp>.sql.gz \
  | docker exec -i meridiano-postgres-production psql "$URL"
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

`REPO`, `APP_USER`, `SERVICE`, `BRANCH`, `PNPM`, `ENV_FILE`, `PG_CONTAINER`,
`BACKUP_DIR`, `BACKUP_KEEP`, `HEALTH_TIMEOUT`, `STATE_DIR`.

#!/usr/bin/env bash
# Makes sure the verify user exists in the dev database and can log in.
#
#   .claude/skills/verify-meridiano-api/scripts/ensure-user.sh
#
# The user is verify@meridiano.local, a dedicated account so journeys never
# write notes or bookmarks into Ana's own account. Its password lives in
# ~/.config/meridiano-verify/user.env (mode 600), shared by every checkout and
# worktree. Safe to rerun: it reuses the stored password, or creates one and
# upserts the row so the stored password and the database always match.
set -euo pipefail

checkout="$(git rev-parse --show-toplevel)"
env_file="$checkout/.env"
creds_dir="$HOME/.config/meridiano-verify"
creds="$creds_dir/user.env"
email='verify@meridiano.local'
username='verify-agent'
container='meridiano-postgres-local'

read_env() { grep -E "^$1=" "$env_file" | head -1 | cut -d= -f2- ; }
db_user="$(read_env DATABASE_USER)"
db_name="$(read_env DATABASE_NAME)"
db_name="${db_name:-meridian}"

if [ -f "$creds" ]; then
  password="$(grep -E '^VERIFY_PASSWORD=' "$creds" | cut -d= -f2-)"
else
  mkdir -p "$creds_dir"
  password="$(openssl rand -hex 16)"
  umask 077
  printf 'VERIFY_EMAIL=%s\nVERIFY_PASSWORD=%s\n' "$email" "$password" >"$creds"
fi

# bcrypt from the repo's own node_modules, so the hash matches what
# AuthService.login compares against.
hash="$(cd "$checkout" && node -e 'process.stdout.write(require("bcrypt").hashSync(process.argv[1], 10))' "$password")"

printf '%s\n' \
  "INSERT INTO users (email, username, password, is_email_verified)" \
  "VALUES (:'email', :'username', :'hash', true)" \
  "ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, is_email_verified = true" \
  "RETURNING id, email, username, is_email_verified;" |
  docker exec -i "$container" psql -U "$db_user" -d "$db_name" -At \
    -v email="$email" -v username="$username" -v hash="$hash" -f -

echo "ensure-user: $email ready, password in $creds"

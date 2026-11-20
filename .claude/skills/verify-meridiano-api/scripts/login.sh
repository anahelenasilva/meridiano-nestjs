#!/usr/bin/env bash
# Logs the verify user in once per run and caches the JWT in $VERIFY_RUN/token.
#
#   VERIFY_RUN=<dir> .claude/skills/verify-meridiano-api/scripts/login.sh
#
# Reuses a cached token while GET /api/ask/models still accepts it, because
# POST /api/auth/login allows 5 attempts per 15 minutes.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/_common.sh"
load_run

creds="$HOME/.config/meridiano-verify/user.env"
[ -f "$creds" ] || { echo "login: no $creds. Run $here/ensure-user.sh first." >&2; exit 1; }

if [ -s "$VERIFY_RUN/token" ]; then
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $(cat "$VERIFY_RUN/token")" "$BASE_URL/api/ask/models")"
  if [ "$code" = 200 ]; then echo "login: cached token valid"; exit 0; fi
fi

email="$(grep -E '^VERIFY_EMAIL=' "$creds" | cut -d= -f2-)"
password="$(grep -E '^VERIFY_PASSWORD=' "$creds" | cut -d= -f2-)"
body="$(jq -nc --arg e "$email" --arg p "$password" '{email:$e,password:$p}')"
resp="$(curl -s -w '\n%{http_code}' -H 'Content-Type: application/json' -d "$body" "$BASE_URL/api/auth/login")"
code="$(printf '%s' "$resp" | tail -n1)"
if [ "$code" != 201 ]; then
  echo "login: POST /api/auth/login returned $code: $(printf '%s' "$resp" | sed '$d')" >&2
  exit 1
fi
umask 077
token="$(printf '%s' "$resp" | sed '$d' | jq -er .access_token)" || { echo "login: response has no access_token" >&2; exit 1; }
printf '%s' "$token" >"$VERIFY_RUN/token"
echo "login: logged in as $email"

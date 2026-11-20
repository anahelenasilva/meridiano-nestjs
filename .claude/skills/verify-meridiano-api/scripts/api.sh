#!/usr/bin/env bash
# Sends one request to the verify instance and records it as evidence.
#
#   VERIFY_RUN=<dir> [AUTH=jwt|apikey|external|none] [HDR='Name: value'] [EXPECT=<status>] \
#     .claude/skills/verify-meridiano-api/scripts/api.sh <label> <METHOD> <path> [json | @file]
#
# AUTH picks the credential: jwt (default) is the verify user's token from
# login.sh, apikey sends x-api-key from .env MERIDIANO_API_KEY, external sends
# X-External-Token with the first EXTERNAL_API_TOKENS entry, none sends nothing.
# HDR adds one extra header. Prints the response body on stdout and
# "HTTP <status> -> <evidence file>" on stderr. With EXPECT set, exits 1 when
# the status differs. Evidence never contains a credential.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
. "$here/_common.sh"
load_run

label="$1" method="$2" path="$3" body="${4:-}"
auth="${AUTH:-jwt}"
args=(-s -X "$method" -o "$VERIFY_RUN/last-body" -w '%{http_code}')

case "$auth" in
  jwt)
    [ -s "$VERIFY_RUN/token" ] || { echo "api: no token. Run login.sh first." >&2; exit 1; }
    args+=(-H "Authorization: Bearer $(cat "$VERIFY_RUN/token")") ;;
  apikey) args+=(-H "x-api-key: $(read_dotenv "$CHECKOUT" MERIDIANO_API_KEY)") ;;
  external) args+=(-H "X-External-Token: $(read_dotenv "$CHECKOUT" EXTERNAL_API_TOKENS | cut -d, -f1)") ;;
  none) ;;
  *) echo "api: AUTH must be jwt, apikey, external or none" >&2; exit 2 ;;
esac
[ -n "${HDR:-}" ] && args+=(-H "$HDR")

body_desc='(none)'
if [ -n "$body" ]; then
  args+=(-H 'Content-Type: application/json')
  if [ "${body#@}" != "$body" ]; then
    args+=(--data-binary "$body")
    body_desc="$(wc -c <"${body#@}" | tr -d ' ') bytes from ${body#@}: $(head -c 300 "${body#@}")"
  else
    args+=(--data-binary "$body")
    body_desc="${#body} chars: $(printf '%s' "$body" | head -c 300)"
  fi
fi

status="$(curl "${args[@]}" "$BASE_URL$path")"

file="$(next_evidence_file "$label")"
resp_len="$(wc -c <"$VERIFY_RUN/last-body" | tr -d ' ')"
{
  echo "time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "build: $SHA ($CHECKOUT)"
  echo "request: $method $path"
  echo "auth: $auth${HDR:+ + header ${HDR%%:*}}"
  echo "body: $body_desc"
  echo "status: $status${EXPECT:+ (expected $EXPECT)}"
  echo "response ($resp_len bytes, first 4000 shown):"
  head -c 4000 "$VERIFY_RUN/last-body"
  echo
} >"$file"

cat "$VERIFY_RUN/last-body"
echo
echo "HTTP $status -> $file" >&2
if [ -n "${EXPECT:-}" ] && [ "$status" != "$EXPECT" ]; then
  echo "api: expected $EXPECT, got $status" >&2
  exit 1
fi

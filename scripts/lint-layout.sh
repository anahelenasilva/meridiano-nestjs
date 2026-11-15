#!/usr/bin/env bash
# Fails on file-layout rules no lint tool covers. Prints `path: rule` per
# violation and exits 1 if there is any.
#
#   pnpm lint:layout
#
# The judgement half of these rules (when a module gets commands/, what a
# command owns) lives in docs/CODING_STANDARDS.md.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

# Services that had no spec when this check landed. Delete an entry when its
# spec is written; the check then keeps the spec from going missing again.
services_without_spec=(
  src/youtube-channels/channel-categories.service.ts
  src/youtube-transcriptions/services/transcript.service.ts
  src/youtube-transcriptions/services/youtube.service.ts
)

violations=0
report() {
  echo "$1: $2"
  violations=$((violations + 1))
}

is_allowlisted() {
  local file="$1" entry
  for entry in ${services_without_spec[@]+"${services_without_spec[@]}"}; do
    [ "$entry" = "$file" ] && return 0
  done
  return 1
}

while IFS= read -r file; do
  if [ ! -e "${file%.ts}.spec.ts" ] && ! is_allowlisted "$file"; then
    report "$file" "service has no sibling .service.spec.ts"
  fi
done < <(find src libs -name '*.service.ts' | sort)

while IFS= read -r file; do
  case "$file" in
    */commands/*.command.ts | */commands/*.command.spec.ts) ;;
    */commands/*) report "$file" "a file in commands/ must be a *.command.ts" ;;
    */queries/*.query.ts | */queries/*.query.spec.ts) ;;
    */queries/*) report "$file" "a file in queries/ must be a *.query.ts" ;;
  esac
done < <(find src libs -type f \( -path '*/commands/*' -o -path '*/queries/*' \) | sort)

while IFS= read -r file; do
  grep -q '@Injectable()' "$file" || report "$file" "command, query or usecase class needs @Injectable()"
  grep -q 'execute(' "$file" || report "$file" "command, query or usecase class needs an execute() method"
done < <(find src libs -type f \( -name '*.command.ts' -o -name '*.query.ts' -o -name '*.usecase.ts' \) | sort)

# src/shared/ is not a domain module, and ADR-0006 names the path of the
# swagger DTO there.
while IFS= read -r file; do
  case "$file" in
    */dto/*) ;;
    *) report "$file" "a DTO lives in a dto/ folder" ;;
  esac
done < <(find src -path src/shared -prune -o -name '*.dto.ts' -print | sort)

if [ "$violations" -gt 0 ]; then
  echo "lint-layout: $violations violation(s)" >&2
  exit 1
fi
echo "lint-layout: ok"

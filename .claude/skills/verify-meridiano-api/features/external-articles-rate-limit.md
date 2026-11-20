# External articles rate limit

Outside tools submit article URLs to `POST /api/articles/external` with an `X-External-Token`. Requests are rate limited before the token check: unknown tokens all share one per-IP bucket of 10 per minute, while each valid token gets its own bucket, keyed by a SHA-256 digest of the token.

## Sub-features

- `external-invalid-token` returns 401 for an unknown token.
- `external-ip-bucket` returns 429 on the 11th request in a minute across any mix of unknown tokens.
- `external-token-bucket` lets a valid token through after the IP bucket is full.
- `external-digest-key` stores the valid token's bucket under `rate_limit:external:token:<64 hex>`, never the raw token.

## How to get to it (user POV)

- Browser extension, shortcuts or scripts that post a URL with `X-External-Token`.

## Driving it with api.sh

Preconditions:

- Baseline from the README, and a fresh launch (Redis db 9 starts empty, so no bucket is partly used).
- `.env` sets `EXTERNAL_API_TOKENS`.

- **Ten unknown tokens.** `for i in $(seq 10); do HDR="X-External-Token: invented-$i" AUTH=none EXPECT=401 $S/api.sh ext-invalid-$i POST /api/articles/external '{}' >/dev/null; done`. Ten 401s.
- **IP bucket full.** `HDR='X-External-Token: invented-11' AUTH=none EXPECT=429 $S/api.sh ext-ip-limited POST /api/articles/external '{}'`.
- **Valid token has its own bucket.** `AUTH=external EXPECT=400 $S/api.sh ext-valid-token POST /api/articles/external '{}'`. A 400 (missing `url`) instead of 429 proves the valid token skipped the full IP bucket, without scraping anything.
- **Keys.** `$S/record.sh ext-keys redis-cli -n 9 --scan --pattern 'rate_limit:*'`. One IP key and one `rate_limit:external:token:<64 hex>` key, and no key per invented token.

## Gotchas

- Never send a valid token with a real `url` here: that scrapes the page, writes an article and queues AI processing. The empty body keeps the check offline.
- The IP bucket stays full for 60 s and blocks every external request on this instance. Run this journey last, or relaunch.
- `EXTERNAL_ARTICLE_SUBMISSION_ENABLED` is unset in the local `.env`, so a valid request with a `url` returns 503 after validation. The 400 path above does not depend on it.

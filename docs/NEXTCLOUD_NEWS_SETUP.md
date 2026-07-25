# Subscribing to the Meridiano Articles Feed in Nextcloud News

The Meridiano API exposes a public RSS feed of Articles at `GET /feeds/articles.xml`. This is a
read-only, pull-based integration: Nextcloud News polls the feed URL on its own schedule, and
Meridiano never talks to Nextcloud. See `src/feeds/` for the implementation and
[PRD #149](https://github.com/anahelenasilva/meridiano-nestjs/issues/149) for the design decisions
behind it.

## Feed URL

```
http://<meridiano-api-host>:<port>/feeds/articles.xml
```

Note the path is `/feeds/articles.xml`, **not** `/api/feeds/articles.xml` — unlike other
controllers, which declare `@Controller('api/...')`, `FeedsController` declares
`@Controller('feeds')` (see `src/feeds/feeds.controller.ts`), so the feed route is not under the
`/api` prefix.

`<meridiano-api-host>:<port>` is whatever host and port the API is reachable at in your deployment
(for example a Tailscale MagicDNS name or IP and the configured `PORT`, default `3001`).

### Query parameters

Both are optional; invalid values fall back to the defaults below rather than erroring.

| Parameter     | Values                                                                                          | Default      |
| ------------- | ------------------------------------------------------------------------------------------------ | ------------ |
| `limit`       | Positive integer, capped at 100                                                                  | 20           |
| `feedProfile` | One of `default`, `technology`, `politics`, `business`, `health`, `science`, `brasil`, `teclas`   | all profiles |

Example — latest 10 Articles from the `technology` Feed Profile only:

```
http://<meridiano-api-host>:<port>/feeds/articles.xml?feedProfile=technology&limit=10
```

The endpoint is public (`@Public()`) — no `Authorization` header is needed or accepted.

## Public-hosting and TLS considerations

The PRD for this feed (#149) places the API, website, and Nextcloud instance on the same Raspberry
Pi environment. Elsewhere in the stack, the frontend reaches the API over plain `http://` using
Tailscale IPs/MagicDNS names rather than a public HTTPS domain (see the Tailscale access pattern
described in `meridiano-frontend/README.md`). Assuming the API is exposed the same way for this
feed, two cases follow:

- **Nextcloud runs on the same Tailscale tailnet as the Raspberry Pi** (e.g. Nextcloud is also
  hosted on the Pi, or on another device joined to the same tailnet): subscribe using the API's
  Tailscale IP or MagicDNS hostname over plain `http://`. Tailscale's WireGuard tunnel already
  encrypts the traffic between nodes, so no additional TLS termination is required for this path.
- **Nextcloud (or the News app) is not on the tailnet** — e.g. a Nextcloud instance hosted
  elsewhere, or the official Nextcloud News mobile app polling from outside the tailnet: it needs a
  network path to the API host. That means either joining that device/app to the tailnet, or
  putting the feed behind a public reverse proxy with a real TLS certificate. That setup is out of
  scope for this integration — the feed itself has no TLS or auth of its own, so whatever fronts it
  publicly is responsible for that.

## Subscribing in Nextcloud News

1. Open the **News** app in Nextcloud (Nextcloud web UI, or the Nextcloud News Android/iOS app).
2. Click **Add feed** (or the **+** button in the folder/feed sidebar).
3. Paste the feed URL, e.g. `http://100.x.x.x:3001/feeds/articles.xml` (adjust host/port and any
   query parameters for your deployment).
4. Optionally assign it to a folder and confirm.
5. Nextcloud News fetches the feed immediately and then polls it on its own refresh interval
   (configurable in News' settings, or triggered manually via the refresh button).

## Verifying successful ingestion

- [ ] The new feed shows the title **"Meridiano Articles"** and the feed's Articles appear in the
      unread list.
- [ ] Items are ordered newest first (feed items are sorted by Article `published_date`,
      descending).
- [ ] Each item shows a title, a link back to the original Article source, a publish date, and a
      preview of the Article Summary (falls back to raw content if no summary was generated yet).
- [ ] Trigger a manual refresh in News (or wait for its polling interval) and confirm no duplicate
      items appear — each item's GUID is the Article's stable id, so re-fetching the same Articles
      does not create new entries.
- [ ] If subscribed with a `feedProfile` filter, confirm only Articles from that profile appear.
- [ ] If the API briefly returns zero items, or an out-of-range `limit`/unknown `feedProfile` is in
      the URL, News should still get a valid (if empty or default-limited) feed rather than an
      error — the endpoint always falls back to safe defaults instead of failing the request.

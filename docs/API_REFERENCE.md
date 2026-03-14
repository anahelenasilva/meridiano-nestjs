# Meridiano API Reference

Reference for the currently implemented HTTP endpoints.

## Base URL

- Default local server: `http://localhost:3001`
- Most endpoints are under `/api/*`

## Authentication

- Protected endpoints require `Authorization: Bearer <jwt>`
- Public endpoints:
  - `GET /`
  - `GET /api/health`
  - `POST /api/auth/login`
  - `POST /api/users`
  - `POST /api/articles/external` (public route, but requires `X-External-Token`)

## Health

### `GET /api/health` (public)

Returns API health status.

```json
{
  "status": "ok",
  "timestamp": "2026-03-10T18:55:00.000Z"
}
```

## Root

### `GET /` (public)

Returns a simple hello message.

```json
"Hello World!"
```

## Auth

### `POST /api/auth/login` (public, rate-limited)

Authenticates a user and returns a JWT.

- Rate limit: 5 attempts per 15 minutes
- Request body:

```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

- Response:

```json
{
  "access_token": "jwt-token",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

- Common errors:
  - `401 Unauthorized` for invalid credentials or unverified email
  - `429 Too Many Requests` when login rate limit is exceeded

## Profiles

### `GET /api/profiles`

Returns the available feed profiles currently configured in the app.

```json
["technology", "brasil", "teclas", "politics"]
```

## Articles

### `GET /api/articles`

Lists articles with filters and pagination.

- Query params:
  - `page` (default `1`)
  - `perPage` (default `20`)
  - `sortBy` (default `published_date`)
  - `direction` (`asc` or `desc`, default `desc`)
  - `feedProfile`
  - `searchTerm`
  - `startDate`
  - `endDate`
  - `preset` (`yesterday`, `last_week`, `last_30d`, `last_3m`, `last_12m`)
  - `category`

- Response shape:

```json
{
  "articles": [],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total_pages": 3,
    "total_articles": 59
  },
  "filters": {
    "sort_by": "published_date",
    "direction": "desc",
    "feed_profile": "technology",
    "search_term": "",
    "start_date": "",
    "end_date": "",
    "preset": "",
    "category": ""
  },
  "available_profiles": ["technology", "brasil"],
  "available_categories": ["news", "research"]
}
```

### `GET /api/articles/:id`

Gets an article by ID and returns related articles.

- Path param: `id` (UUID)
- Optional query param: `includeAudio=true`
- Response shape:

```json
{
  "article": {
    "id": "uuid",
    "title": "Article title",
    "audio": {
      "id": "audio-uuid",
      "s3_key": "audio/file.mp3",
      "file_size_bytes": 1024,
      "duration_seconds": 90,
      "presigned_url": "https://..."
    },
    "audio_error": "Audio not available for this resource"
  },
  "related_articles": []
}
```

`audio` and `audio_error` are only evaluated when `includeAudio=true`.

### `POST /api/articles`

Scrapes one article and queues processing.

```json
{
  "url": "https://example.com/article",
  "feedProfile": "technology",
  "generateAudio": true
}
```

`generateAudio` is optional. When `true`, the processing pipeline also enqueues article audio generation.

Response includes queue metadata:

```json
{
  "success": true,
  "jobId": "123",
  "articleFileKey": "article-uuid",
  "message": "Article scraped and queued for processing"
}
```

### `DELETE /api/articles/:id`

Deletes an article.

```json
{
  "success": true
}
```

### `POST /api/articles/upload-url`

Generates a presigned POST for markdown upload.

```json
{
  "articleFileName": "article.md",
  "s3Bucket": "optional-bucket-name",
  "contentType": "text/markdown",
  "fileSize": 1024
}
```

`contentType` accepted values: `text/markdown`, `text/plain`.

### `POST /api/articles/markdown`

Queues a markdown article stored in S3.

```json
{
  "s3Key": "article.md",
  "feedProfile": "technology",
  "s3Bucket": "optional-bucket-name",
  "generateAudio": true
}
```

`generateAudio` is optional. When `true`, the processing pipeline also enqueues article audio generation.

Response:

```json
{
  "success": true,
  "jobId": "123",
  "articleFileKey": "article.md",
  "message": "Markdown article queued for processing"
}
```

### `GET /api/articles/jobs/:jobId`

Returns article-processing job status.

```json
{
  "jobId": "123",
  "state": "completed",
  "progress": 100,
  "result": {},
  "error": null,
  "data": {}
}
```

### `POST /api/articles/:id/audio`

Queues audio generation for an article (`202 Accepted`).

```json
{
  "jobId": "audio-job-id",
  "message": "Audio generation queued successfully"
}
```

### `GET /api/articles/:id/audio/status/:jobId`

Gets audio generation status for an article.

```json
{
  "jobId": "audio-job-id",
  "state": "completed",
  "progress": 100,
  "result": {},
  "error": null,
  "data": {
    "sourceType": "article",
    "sourceId": "uuid",
    "text": "..."
  }
}
```

## External Article Submission

### `POST /api/articles/external` (public, token-protected, rate-limited)

Public endpoint for external sources (for example bots) to submit article URLs.

- Required header: `X-External-Token: <token>`
- Rate limit: 10 requests per minute per token/IP
- Request body:

```json
{
  "url": "https://example.com/news",
  "feedProfile": "technology",
  "generateAudio": true,
  "source": "telegram",
  "metadata": {
    "chatId": "12345",
    "messageId": "67890",
    "username": "bot-user",
    "note": "optional context"
  }
}
```

`generateAudio` is optional. When `true`, the processing pipeline also enqueues article audio generation.

- Success response:

```json
{
  "success": true,
  "jobId": "123",
  "articleId": "uuid",
  "message": "Article submitted successfully and queued for processing"
}
```

- Error format:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_URL",
    "message": "The URL you provided doesn't seem valid. Please check and try again."
  }
}
```

Error codes:
- `INVALID_URL`
- `INVALID_FEED_PROFILE`
- `UNAUTHORIZED`
- `RATE_LIMIT_EXCEEDED`
- `ARTICLE_EXISTS`
- `SCRAPE_FAILED`
- `INTERNAL_ERROR`

## Briefings

### `GET /api/briefings`

Lists briefing metadata.

- Optional query param: `feedProfile`
- Response shape:

```json
{
  "briefings": [
    {
      "id": "uuid",
      "generated_at": "2026-03-10T18:55:00.000Z",
      "feed_profile": "technology"
    }
  ],
  "current_feed_profile": "technology",
  "available_profiles": ["technology", "brasil"]
}
```

### `GET /api/briefings/:id`

Gets a briefing by ID.

```json
{
  "id": "uuid",
  "brief_markdown": "# Brief content",
  "generated_at": "2026-03-10T18:55:00.000Z",
  "feed_profile": "technology"
}
```

When not found, current implementation returns:

```json
{
  "error": "Briefing not found"
}
```

## YouTube Transcriptions

### `GET /api/youtube/transcriptions`

Lists all transcriptions plus available channel filters.

```json
{
  "transcriptions": [],
  "available_channels": [
    {
      "id": "channel-id",
      "name": "Channel name"
    }
  ]
}
```

### `POST /api/youtube/transcriptions`

Processes one video URL and stores transcription.

```json
{
  "url": "https://www.youtube.com/watch?v=abc123",
  "channelId": "channel-id",
  "generateAudio": true
}
```

`generateAudio` is optional. When `true`, audio generation is enqueued after transcription summary processing.

```json
{
  "success": true,
  "transcriptionId": "uuid",
  "message": "Video transcription saved successfully"
}
```

### `GET /api/youtube/transcriptions/:id`

Gets one transcription.

- Path param: `id` (UUID)
- Optional query param: `includeAudio=true`

```json
{
  "transcription": {
    "id": "uuid",
    "channelId": "channel-id",
    "channelName": "Channel",
    "videoTitle": "Video title",
    "videoUrl": "https://www.youtube.com/watch?v=abc123",
    "processedAt": "2026-03-10T18:55:00.000Z",
    "transcriptionText": "...",
    "transcriptionSummary": "...",
    "thumbnailUrl": "https://..."
  },
  "audio": {
    "id": "audio-uuid",
    "s3_key": "audio/file.mp3",
    "file_size_bytes": 1024,
    "duration_seconds": 90,
    "presigned_url": "https://..."
  },
  "audio_error": "Audio not available for this resource"
}
```

### `DELETE /api/youtube/transcriptions/:id`

Deletes one transcription.

```json
{
  "sucess": true
}
```

Note: response key is currently spelled `sucess` in implementation.

### `POST /api/youtube/transcriptions/:id/audio`

Queues audio generation for a transcription (`202 Accepted`).

```json
{
  "jobId": "audio-job-id",
  "message": "Audio generation queued successfully"
}
```

## YouTube Channels

### `GET /api/youtube/channels`

Lists channels.

```json
[
  {
    "id": "uuid",
    "channelId": "UCxxxx",
    "url": "https://youtube.com/@name",
    "name": "Channel Name",
    "description": "Description",
    "enabled": true,
    "maxVideos": 10
  }
]
```

### `POST /api/youtube/channels`

Creates a channel.

```json
{
  "channelId": "UCxxxx",
  "name": "Channel Name",
  "url": "https://youtube.com/@name",
  "description": "Description",
  "enabled": true,
  "maxVideos": 10
}
```

```json
{
  "id": "uuid",
  "channelId": "UCxxxx",
  "name": "Channel Name",
  "url": "https://youtube.com/@name",
  "description": "Description",
  "enabled": true,
  "maxVideos": 10,
  "createdAt": "2026-03-10T18:55:00.000Z",
  "updatedAt": "2026-03-10T18:55:00.000Z"
}
```

### `PATCH /api/youtube/channels/:channelId`

Enables/disables a channel.

```json
{
  "enabled": false
}
```

```json
{
  "success": true,
  "message": "Channel disabled successfully"
}
```

## Bookmarks

### `POST /api/bookmarks`

Creates a bookmark.

```json
{
  "user_id": "user-uuid",
  "article_id": "article-uuid"
}
```

```json
{
  "id": "bookmark-uuid",
  "user_id": "user-uuid",
  "article_id": "article-uuid",
  "created_at": "2026-03-10T18:55:00.000Z"
}
```

### `GET /api/bookmarks`

Lists bookmarks for a user.

- Required query param: `user_id`
- Optional: `page`, `per_page`

```json
{
  "bookmarks": [],
  "total": 12,
  "page": 1,
  "perPage": 20,
  "totalPages": 1
}
```

### `DELETE /api/bookmarks`

Deletes a bookmark.

- Required query params: `user_id`, `article_id`

```json
{
  "success": true,
  "message": "Bookmark removed successfully"
}
```

### `GET /api/bookmarks/check/:articleId`

Checks bookmark status for a given user/article pair.

- Path param: `articleId`
- Required query param: `user_id`

```json
{
  "bookmarked": true
}
```

### `GET /api/bookmarks/count`

Returns bookmark count for a user.

- Required query param: `user_id`

```json
{
  "count": 42
}
```

## Users

### `POST /api/users` (public)

Creates a user.

```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "Password123"
}
```

Password rules:
- minimum 8 chars
- at least one letter
- at least one uppercase letter
- at least one number

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "created_at": "2026-03-10T18:55:00.000Z"
}
```

### `GET /api/users/:id`

Gets user by ID.

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "johndoe",
  "created_at": "2026-03-10T18:55:00.000Z"
}
```

Common error: `404 Not Found` with message `Invalid user`.

## Feed Profile Values

These values are accepted by endpoints that require `feedProfile`:

- `default`
- `technology`
- `politics`
- `business`
- `health`
- `science`
- `brasil`
- `teclas`

## Last Updated

March 2026

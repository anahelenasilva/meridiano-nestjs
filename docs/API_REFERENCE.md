# Meridiano API Reference

Complete API documentation for the Meridiano REST API.

**Base URL**: `http://localhost:3000/api`

**Authentication**: All endpoints require JWT authentication via `Authorization: Bearer <token>` header, except those marked with 🔓.

---

## 📑 Table of Contents

- [Authentication](#authentication)
- [Articles](#articles)
- [Briefings](#briefings)
- [YouTube Transcriptions](#youtube-transcriptions)
- [YouTube Channels](#youtube-channels)
- [Bookmarks](#bookmarks)
- [Users](#users)

---

## 🔐 Authentication

### Login

**Endpoint**: `POST /auth/login` 🔓

Authenticate a user and receive a JWT token.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

**Error Responses**:
- `401 Unauthorized` - Invalid credentials
- `429 Too Many Requests` - Rate limit exceeded

---

## 📰 Articles

### List Articles

**Endpoint**: `GET /articles`

Retrieve a paginated list of articles with optional filtering.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number (default: 1) |
| `per_page` | number | No | Items per page (default: 20, max: 100) |
| `feedProfile` | string | No | Filter by feed profile (e.g., "technology", "brasil") |
| `search` | string | No | Search query for title and content |
| `category` | string | No | Filter by category |
| `fromDate` | string | No | Filter from date (ISO 8601) |
| `toDate` | string | No | Filter to date (ISO 8601) |
| `sortBy` | string | No | Sort field: "published_date", "impact", "created_at" |
| `sortOrder` | string | No | Sort order: "asc", "desc" |

**Response** (200 OK):
```json
{
  "articles": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Article Title",
      "url": "https://example.com/article",
      "source": "Example Source",
      "published_date": "2026-03-01T00:00:00.000Z",
      "impact": 8,
      "category": "technology",
      "feed_profile": "technology",
      "processed_content": "Article summary...",
      "raw_content": "Full article content...",
      "image_url": "https://example.com/image.jpg",
      "created_at": "2026-03-01T12:00:00.000Z",
      "updated_at": "2026-03-01T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "perPage": 20,
    "totalPages": 8
  }
}
```

---

### Get Article by ID

**Endpoint**: `GET /articles/:id`

Retrieve a single article by its UUID.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Article unique identifier |

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `includeAudio` | boolean | Include associated audio file metadata |

**Response** (200 OK):
```json
{
  "article": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Article Title",
    "url": "https://example.com/article",
    "source": "Example Source",
    "published_date": "2026-03-01T00:00:00.000Z",
    "impact": 8,
    "category": "technology",
    "feed_profile": "technology",
    "processed_content": "Article summary...",
    "raw_content": "Full article content...",
    "image_url": "https://example.com/image.jpg",
    "created_at": "2026-03-01T12:00:00.000Z",
    "updated_at": "2026-03-01T12:00:00.000Z"
  },
  "audio": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "url": "https://s3.amazonaws.com/bucket/audio.mp3",
    "expires_at": "2026-03-01T13:00:00.000Z"
  }
}
```

**Error Responses**:
- `404 Not Found` - Article not found

---

### Create Article

**Endpoint**: `POST /articles`

Scrape and add a new article from a URL.

**Request Body**:
```json
{
  "url": "https://example.com/article",
  "feedProfile": "technology"
}
```

**Response** (201 Created):
```json
{
  "jobId": "job-123456",
  "message": "Article scraped and queued for processing"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid URL or article already exists
- `409 Conflict` - Article already exists in database

---

### Delete Article

**Endpoint**: `DELETE /articles/:id`

Delete an article by its UUID.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Article unique identifier |

**Response** (200 OK):
```json
{
  "success": true
}
```

---

### Generate Upload URL

**Endpoint**: `POST /articles/upload-url`

Generate a presigned URL for uploading a markdown file directly to S3.

**Request Body**:
```json
{
  "articleFileName": "article-123.md",
  "s3Bucket": "my-bucket",
  "contentType": "text/markdown",
  "fileSize": 1024
}
```

**Response** (200 OK):
```json
{
  "url": "https://s3.amazonaws.com/my-bucket",
  "fields": {
    "key": "article-123.md",
    "bucket": "my-bucket",
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": "...",
    "X-Amz-Date": "20260301T000000Z",
    "X-Amz-Signature": "..."
  }
}
```

---

### Process Markdown Article

**Endpoint**: `POST /articles/markdown`

Queue a markdown file from S3 for processing.

**Request Body**:
```json
{
  "s3Key": "article-123.md",
  "feedProfile": "technology",
  "s3Bucket": "my-bucket"
}
```

**Response** (202 Accepted):
```json
{
  "jobId": "job-123456",
  "message": "Markdown article queued for processing"
}
```

---

### Get Job Status

**Endpoint**: `GET /articles/jobs/:jobId`

Check the status of a background job.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Job identifier |

**Response** (200 OK):
```json
{
  "jobId": "job-123456",
  "state": "completed",
  "progress": 100,
  "result": {
    "articleId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Job States**: `waiting`, `active`, `completed`, `failed`

---

### Generate Audio for Article

**Endpoint**: `POST /articles/:id/audio`

Queue audio generation for an article.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Article unique identifier |

**Response** (202 Accepted):
```json
{
  "jobId": "audio-job-123456",
  "message": "Audio generation queued successfully"
}
```

**Error Responses**:
- `404 Not Found` - Article not found
- `409 Conflict` - Audio already exists or generation in progress
- `400 Bad Request` - Article has no content for audio generation

---

### Get Audio Job Status

**Endpoint**: `GET /articles/:id/audio/status/:jobId`

Check the status of an audio generation job.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Article unique identifier |
| `jobId` | string | Audio job identifier |

**Response** (200 OK):
```json
{
  "jobId": "audio-job-123456",
  "state": "completed",
  "data": {
    "sourceId": "550e8400-e29b-41d4-a716-446655440000",
    "sourceType": "article"
  },
  "result": {
    "audioId": "550e8400-e29b-41d4-a716-446655440001"
  }
}
```

---

## 📊 Briefings

### List Briefings

**Endpoint**: `GET /briefings`

Retrieve all briefing metadata.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feedProfile` | string | No | Filter by feed profile |

**Response** (200 OK):
```json
{
  "briefings": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Tech Briefing - March 1, 2026",
      "feed_profile": "technology",
      "created_at": "2026-03-01T08:00:00.000Z",
      "article_count": 15
    }
  ]
}
```

---

### Get Briefing by ID

**Endpoint**: `GET /briefings/:id`

Retrieve a full briefing with content.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Briefing unique identifier |

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Tech Briefing - March 1, 2026",
  "feed_profile": "technology",
  "content": "# Today's Technology Briefing\n\n## Key Stories\n\n### 1. AI Breakthrough...",
  "articles": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "Related Article",
      "url": "https://example.com/article"
    }
  ],
  "created_at": "2026-03-01T08:00:00.000Z"
}
```

---

## 🎬 YouTube Transcriptions

### List Transcriptions

**Endpoint**: `GET /youtube/transcriptions`

Retrieve all YouTube transcriptions.

**Response** (200 OK):
```json
{
  "transcriptions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "videoId": "dQw4w9WgXcQ",
      "title": "Video Title",
      "channelId": "channel-123",
      "channelName": "Channel Name",
      "thumbnailUrl": "https://img.youtube.com/vi/...",
      "postedAt": "2026-03-01T00:00:00.000Z",
      "transcriptionText": "Full transcript text...",
      "transcriptionSummary": "AI-generated summary...",
      "created_at": "2026-03-01T12:00:00.000Z"
    }
  ]
}
```

---

### Get Transcription by ID

**Endpoint**: `GET /youtube/transcriptions/:id`

Retrieve a single transcription.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Transcription unique identifier |

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `includeAudio` | boolean | Include associated audio file metadata |

**Response** (200 OK):
```json
{
  "transcription": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "videoId": "dQw4w9WgXcQ",
    "title": "Video Title",
    "channelId": "channel-123",
    "channelName": "Channel Name",
    "thumbnailUrl": "https://img.youtube.com/vi/...",
    "postedAt": "2026-03-01T00:00:00.000Z",
    "transcriptionText": "Full transcript text...",
    "transcriptionSummary": "AI-generated summary...",
    "created_at": "2026-03-01T12:00:00.000Z"
  },
  "audio": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "url": "https://s3.amazonaws.com/bucket/audio.mp3",
    "expires_at": "2026-03-01T13:00:00.000Z"
  }
}
```

---

### Create Transcription

**Endpoint**: `POST /youtube/transcriptions`

Extract and process a YouTube video transcript.

**Request Body**:
```json
{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "channelId": "channel-123"
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "videoId": "dQw4w9WgXcQ",
  "title": "Video Title",
  "channelId": "channel-123",
  "message": "Transcription queued for processing"
}
```

---

### Delete Transcription

**Endpoint**: `DELETE /youtube/transcriptions/:id`

Delete a transcription by its UUID.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Transcription unique identifier |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Transcription deleted successfully"
}
```

---

### Generate Audio for Transcription

**Endpoint**: `POST /youtube/transcriptions/:id/audio`

Queue audio generation for a transcription.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Transcription unique identifier |

**Response** (202 Accepted):
```json
{
  "jobId": "audio-job-123456",
  "message": "Audio generation queued successfully"
}
```

---

## 📺 YouTube Channels

### List Channels

**Endpoint**: `GET /youtube/channels`

Retrieve all configured YouTube channels.

**Response** (200 OK):
```json
{
  "channels": [
    {
      "id": "channel-123",
      "name": "Tech Channel",
      "url": "https://youtube.com/c/techchannel",
      "description": "Technology news and reviews",
      "enabled": true,
      "maxVideos": 10,
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Create Channel

**Endpoint**: `POST /youtube/channels`

Add a new YouTube channel for monitoring.

**Request Body**:
```json
{
  "channelId": "UCxxxxxxxxxxxxxxxxxxx",
  "name": "Channel Name",
  "url": "https://youtube.com/c/channelname",
  "description": "Channel description",
  "enabled": true,
  "maxVideos": 10
}
```

**Response** (201 Created):
```json
{
  "id": "UCxxxxxxxxxxxxxxxxxxx",
  "name": "Channel Name",
  "url": "https://youtube.com/c/channelname",
  "description": "Channel description",
  "enabled": true,
  "maxVideos": 10,
  "created_at": "2026-03-01T12:00:00.000Z"
}
```

---

### Update Channel Status

**Endpoint**: `PATCH /youtube/channels/:channelId`

Enable or disable a channel.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `channelId` | string | YouTube channel ID |

**Request Body**:
```json
{
  "enabled": false
}
```

**Response** (200 OK):
```json
{
  "id": "UCxxxxxxxxxxxxxxxxxxx",
  "name": "Channel Name",
  "enabled": false,
  "updated_at": "2026-03-01T12:00:00.000Z"
}
```

---

## 🔖 Bookmarks

### Add Bookmark

**Endpoint**: `POST /bookmarks`

Save an article to bookmarks.

**Request Body**:
```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "article_id": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "article_id": "550e8400-e29b-41d4-a716-446655440001",
  "created_at": "2026-03-01T12:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found` - User or article not found
- `400 Bad Request` - Article already bookmarked

---

### List Bookmarks

**Endpoint**: `GET /bookmarks`

Retrieve user's bookmarked articles.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | UUID | Yes | User unique identifier |
| `page` | number | No | Page number (default: 1) |
| `per_page` | number | No | Items per page (default: 20, max: 100) |

**Response** (200 OK):
```json
{
  "bookmarks": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "article_id": "550e8400-e29b-41d4-a716-446655440001",
      "article": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "title": "Article Title",
        "url": "https://example.com/article",
        "source": "Example Source",
        "published_date": "2026-03-01T00:00:00.000Z",
        "impact": 8
      },
      "created_at": "2026-03-01T12:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "perPage": 20,
  "totalPages": 3
}
```

---

### Remove Bookmark

**Endpoint**: `DELETE /bookmarks`

Remove an article from bookmarks.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | UUID | Yes | User unique identifier |
| `article_id` | UUID | Yes | Article unique identifier |

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Bookmark removed successfully"
}
```

**Error Responses**:
- `404 Not Found` - Bookmark not found

---

### Check Bookmark Status

**Endpoint**: `GET /bookmarks/check/:articleId`

Check if an article is bookmarked by a user.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `articleId` | UUID | Article unique identifier |

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | UUID | Yes | User unique identifier |

**Response** (200 OK):
```json
{
  "bookmarked": true
}
```

---

### Get Bookmark Count

**Endpoint**: `GET /bookmarks/count`

Get the total number of bookmarks for a user.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | UUID | Yes | User unique identifier |

**Response** (200 OK):
```json
{
  "count": 42
}
```

---

## 👤 Users

### Create User

**Endpoint**: `POST /users` 🔓

Register a new user account.

**Request Body**:
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securePassword123"
}
```

**Validation Rules**:
- `email`: Valid email format
- `username`: Alphanumeric, underscores, hyphens only
- `password`: Minimum 8 characters

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "johndoe",
  "created_at": "2026-03-01T12:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid input or user already exists
- `409 Conflict` - Email or username already taken

---

### Get User by ID

**Endpoint**: `GET /users/:id`

Retrieve user information.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | User unique identifier |

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "username": "johndoe",
  "created_at": "2026-03-01T12:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found` - User not found

---

## 📊 HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | OK - Request succeeded |
| `201` | Created - Resource created successfully |
| `202` | Accepted - Request accepted for processing |
| `400` | Bad Request - Invalid input or parameters |
| `401` | Unauthorized - Authentication required or invalid |
| `404` | Not Found - Resource not found |
| `409` | Conflict - Resource conflict (e.g., already exists) |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error - Server error |

---

## 🔑 Authentication Header

All protected endpoints require the JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📅 Date Formats

All dates are returned in ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`

---

## 📄 Content Types

- **Request**: `application/json`
- **Response**: `application/json`

---

*Last updated: March 2026*

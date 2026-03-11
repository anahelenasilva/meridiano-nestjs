# Bookmarks API Documentation

## Overview
The Bookmarks API allows users to save articles for later reading. Each user can bookmark articles, view their bookmarks, and manage their saved content.

## Table of Contents
- [Bookmarks API Documentation](#bookmarks-api-documentation)
  - [Overview](#overview)
  - [Table of Contents](#table-of-contents)
  - [Base URL](#base-url)
  - [Users API](#users-api)
    - [Create User](#create-user)
    - [Get User by ID](#get-user-by-id)
  - [Bookmarks API](#bookmarks-api)
    - [Add Bookmark](#add-bookmark)
    - [Remove Bookmark](#remove-bookmark)
    - [Get Bookmarks](#get-bookmarks)
    - [Check if Article is Bookmarked](#check-if-article-is-bookmarked)
    - [Get Bookmark Count](#get-bookmark-count)
  - [Seed User](#seed-user)
  - [Error Handling](#error-handling)
    - [Common HTTP Status Codes](#common-http-status-codes)
  - [Database Schema](#database-schema)
    - [Users Table](#users-table)
    - [Bookmarks Table](#bookmarks-table)
  - [Integration Examples](#integration-examples)
    - [Complete Workflow Example](#complete-workflow-example)
  - [Notes](#notes)
    - [General](#general)
    - [Authentication](#authentication)
    - [Data Integrity](#data-integrity)
    - [Validation](#validation)
    - [Performance](#performance)
    - [Best Practices](#best-practices)

## Base URL
```
http://localhost:3000/api
```

> **Note:** This API currently does not require authentication. The `user_id` must be provided in requests. Future versions will include JWT/session-based authentication.

---

## Users API

### Create User
Create a new user account.

**Endpoint:** `POST /api/users`

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe"
}
```

**Validation Rules:**
- `email`:
  - Must be a valid email format
  - Required
  - Must be unique across all users
- `username`:
  - Required
  - Must be 3-30 characters long
  - Only letters, numbers, underscores (`_`), and hyphens (`-`) allowed
  - Must be unique across all users
  - Case-sensitive (e.g., `JohnDoe` and `johndoe` are different)

**Success Response (201):**
```json
{
  "id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
  "email": "user@example.com",
  "username": "johndoe",
  "created_at": "2026-01-10T17:08:09.834Z"
}
```

**Error Responses:**

- **409 Conflict** - Email already exists
```json
{
  "statusCode": 409,
  "message": "Email already exists",
  "error": "Conflict"
}
```

- **409 Conflict** - Username already exists
```json
{
  "statusCode": 409,
  "message": "Username already exists",
  "error": "Conflict"
}
```

- **400 Bad Request** - Validation error
```json
{
  "statusCode": 400,
  "message": [
    "Username must be at least 3 characters long",
    "Username can only contain letters, numbers, underscores, and hyphens"
  ],
  "error": "Bad Request"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "username": "johndoe"
  }'
```

---

### Get User by ID
Retrieve user details by their ID.

**Endpoint:** `GET /api/users/:id`

**URL Parameters:**
- `id` (UUID): User ID

**Success Response (200):**
```json
{
  "id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
  "email": "user@example.com",
  "username": "johndoe",
  "created_at": "2026-01-10T17:08:09.834Z"
}
```

**Error Responses:**

- **404 Not Found** - User not found
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

- **400 Bad Request** - Invalid UUID format
```json
{
  "statusCode": 400,
  "message": "Validation failed (uuid is expected)",
  "error": "Bad Request"
}
```

**Example:**
```bash
curl http://localhost:3000/api/users/4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93
```

---

## Bookmarks API

### Add Bookmark
Bookmark an article for later reading.

**Endpoint:** `POST /api/bookmarks`

**Request Body:**
```json
{
  "user_id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
  "article_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Validation Rules:**
- `user_id`: Must be a valid UUID, required
- `article_id`: Must be a valid UUID, required

**Success Response (201):**
```json
{
  "id": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
  "user_id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
  "article_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "created_at": "2026-01-10T18:30:00.000Z"
}
```

**Error Responses:**

- **404 Not Found** - User not found
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

- **404 Not Found** - Article not found
```json
{
  "statusCode": 404,
  "message": "Article not found",
  "error": "Not Found"
}
```

- **400 Bad Request** - Article already bookmarked
```json
{
  "statusCode": 400,
  "message": "Article is already bookmarked",
  "error": "Bad Request"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
    "article_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

---

### Remove Bookmark
Remove a bookmarked article.

**Endpoint:** `DELETE /api/bookmarks`

**Query Parameters:**
- `user_id` (UUID, required): User ID
- `article_id` (UUID, required): Article ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Bookmark removed successfully"
}
```

**Error Responses:**

- **404 Not Found** - Bookmark not found
```json
{
  "statusCode": 404,
  "message": "Bookmark not found",
  "error": "Not Found"
}
```

**Example:**
```bash
curl -X DELETE "http://localhost:3000/api/bookmarks?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93&article_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

---

### Get Bookmarks
Retrieve a paginated list of user's bookmarks with full article details.

**Endpoint:** `GET /api/bookmarks`

**Query Parameters:**
- `user_id` (UUID, required): User ID
- `page` (number, optional): Page number (default: 1)
- `per_page` (number, optional): Items per page (default: 20, max: 100)

**Success Response (200):**
```json
{
  "bookmarks": [
    {
      "id": "b1c2d3e4-f5a6-7890-bcde-f12345678901",
      "user_id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
      "article_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "created_at": "2026-01-10T18:30:00.000Z",
      "article": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "title": "Understanding NestJS Modules",
        "url": "https://example.com/article",
        "published_date": "2026-01-09T10:00:00.000Z",
        "feed_source": "Tech Blog",
        "feed_profile": "technology",
        "image_url": "https://example.com/image.jpg",
        "raw_content": "Article content...",
        "processed_content": "Processed content...",
        "categories": ["nodejs", "typescript"],
        "impact_rating": 8,
        "created_at": "2026-01-09T10:30:00.000Z"
      }
    }
  ],
  "total": 42,
  "page": 1,
  "perPage": 20,
  "totalPages": 3
}
```

**Error Responses:**

- **400 Bad Request** - Invalid pagination parameters
```json
{
  "statusCode": 400,
  "message": "Invalid pagination parameters. Page must be >= 1, per_page must be between 1 and 100",
  "error": "Bad Request"
}
```

**Example:**
```bash
curl "http://localhost:3000/api/bookmarks?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93&page=1&per_page=20"
```

---

### Check if Article is Bookmarked
Check whether a specific article is bookmarked by a user.

**Endpoint:** `GET /api/bookmarks/check/:articleId`

**URL Parameters:**
- `articleId` (UUID): Article ID

**Query Parameters:**
- `user_id` (UUID, required): User ID

**Success Response (200):**
```json
{
  "bookmarked": true
}
```

**Example:**
```bash
curl "http://localhost:3000/api/bookmarks/check/a1b2c3d4-e5f6-7890-abcd-ef1234567890?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93"
```

---

### Get Bookmark Count
Get the total number of bookmarks for a user.

**Endpoint:** `GET /api/bookmarks/count`

**Query Parameters:**
- `user_id` (UUID, required): User ID

**Success Response (200):**
```json
{
  "count": 42
}
```

**Example:**
```bash
curl "http://localhost:3000/api/bookmarks/count?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93"
```

---

## Seed User

A default user is automatically created during database migration:

```json
{
  "id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
  "email": "anahelenarp@hotmail.com",
  "username": "anahelena",
  "created_at": "2026-01-10T17:08:09.834Z"
}
```

You can use this user ID for testing the bookmarks API.

---

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "statusCode": 400,
  "message": "Error message or array of validation errors",
  "error": "Error Type"
}
```

### Common HTTP Status Codes

- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid input or validation error
- **404 Not Found** - Resource not found
- **409 Conflict** - Resource already exists (duplicate)
- **500 Internal Server Error** - Server error

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Bookmarks Table
```sql
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  article_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookmark_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_bookmark_article FOREIGN KEY (article_id)
    REFERENCES articles(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_article UNIQUE (user_id, article_id)
);

CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_article_id ON bookmarks(article_id);
CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at DESC);
```

---

## Integration Examples

### Complete Workflow Example

```bash
# 1. Create a user
USER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "username": "testuser"}')

USER_ID=$(echo $USER_RESPONSE | jq -r '.id')

# 2. Get list of articles
ARTICLES=$(curl -s http://localhost:3000/api/articles)
ARTICLE_ID=$(echo $ARTICLES | jq -r '.articles[0].id')

# 3. Bookmark an article
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Content-Type: application/json" \
  -d "{\"user_id\": \"$USER_ID\", \"article_id\": \"$ARTICLE_ID\"}"

# 4. Get all bookmarks
curl "http://localhost:3000/api/bookmarks?user_id=$USER_ID"

# 5. Check if article is bookmarked
curl "http://localhost:3000/api/bookmarks/check/$ARTICLE_ID?user_id=$USER_ID"

# 6. Get bookmark count
curl "http://localhost:3000/api/bookmarks/count?user_id=$USER_ID"

# 7. Remove bookmark
curl -X DELETE "http://localhost:3000/api/bookmarks?user_id=$USER_ID&article_id=$ARTICLE_ID"
```

---

## Notes

### General
- All UUIDs are version 4 (random) and auto-generated
- Timestamps are in ISO 8601 format (e.g., `2026-01-10T17:08:09.834Z`)
- The API uses PostgreSQL as the database backend

### Authentication
- **No authentication required** currently - `user_id` must be provided in requests
- This is a temporary approach for development
- Future versions will implement JWT/session-based authentication
- The `user_id` parameter will be replaced by session/token user identification

### Data Integrity
- Bookmarks are automatically deleted when the associated user or article is deleted (CASCADE)
- Duplicate bookmarks are prevented at the database level with a unique constraint
- Foreign key constraints ensure referential integrity

### Validation
- Username validation is case-sensitive (`JohnDoe` ≠ `johndoe`)
- Email validation follows standard RFC 5322 email format rules
- UUID validation ensures only valid UUIDs are accepted in path/query parameters

### Performance
- Database indexes on `user_id`, `article_id`, and `created_at` ensure fast queries
- Pagination is recommended for large bookmark collections (max 100 items per page)

### Best Practices
- Always check if an article is bookmarked before attempting to add a bookmark
- Use the bookmark count endpoint to show users their total saved articles
- Handle 409 Conflict errors gracefully when duplicate usernames/emails are detected
- Implement proper error handling for all API calls

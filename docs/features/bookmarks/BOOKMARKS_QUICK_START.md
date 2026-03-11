# Bookmarks Quick Start Guide

## Overview
Quick reference for using the bookmarks API with the seed user.

## Seed User Credentials

```json
{
  "id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
  "email": "anahelenarp@hotmail.com",
  "username": "anahelena"
}
```

## Quick Examples

### 1. Create a New User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "username": "newuser123"
  }'
```

### 2. Bookmark an Article (using seed user)

```bash
# Replace ARTICLE_ID with an actual article ID from your database
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
    "article_id": "ARTICLE_ID"
  }'
```

### 3. Get Your Bookmarks

```bash
curl "http://localhost:3000/api/bookmarks?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93&page=1&per_page=20"
```

### 4. Check if Article is Bookmarked

```bash
curl "http://localhost:3000/api/bookmarks/check/ARTICLE_ID?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93"
```

### 5. Get Bookmark Count

```bash
curl "http://localhost:3000/api/bookmarks/count?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93"
```

### 6. Remove a Bookmark

```bash
curl -X DELETE "http://localhost:3000/api/bookmarks?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93&article_id=ARTICLE_ID"
```

## Getting Article IDs

To get available articles:

```bash
curl http://localhost:3000/api/articles | jq '.articles[].id'
```

## Username Validation Rules

When creating a user, the username must:
- Be 3-30 characters long
- Only contain letters, numbers, underscores, and hyphens
- Be unique across all users

**Valid examples:**
- `john_doe`
- `user123`
- `my-username`
- `JohnDoe2024`

**Invalid examples:**
- `ab` (too short)
- `user@name` (contains @)
- `user name` (contains space)
- `user.name` (contains period)

## Common Error Responses

### Email Already Exists (409)
```json
{
  "statusCode": 409,
  "message": "Email already exists",
  "error": "Conflict"
}
```

### Username Already Exists (409)
```json
{
  "statusCode": 409,
  "message": "Username already exists",
  "error": "Conflict"
}
```

### Article Already Bookmarked (400)
```json
{
  "statusCode": 400,
  "message": "Article is already bookmarked",
  "error": "Bad Request"
}
```

### Invalid Username Format (400)
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

## Testing Workflow

```bash
# 1. Get an article ID
ARTICLE_ID=$(curl -s http://localhost:3000/api/articles | jq -r '.articles[0].id')

# 2. Bookmark it (using seed user)
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93\",
    \"article_id\": \"$ARTICLE_ID\"
  }"

# 3. View your bookmarks
curl "http://localhost:3000/api/bookmarks?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93"

# 4. Check bookmark count
curl "http://localhost:3000/api/bookmarks/count?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93"
```

## Database Access

To view users directly in the database:

```bash
docker exec -it meridiano-postgres-local psql -U postgres -d meridian -c "SELECT * FROM users;"
```

To view bookmarks:

```bash
docker exec -it meridiano-postgres-local psql -U postgres -d meridian -c "SELECT b.id, u.username, a.title FROM bookmarks b JOIN users u ON b.user_id = u.id JOIN articles a ON b.article_id = a.id;"
```

## For Full Documentation

See [BOOKMARKS_API.md](./BOOKMARKS_API.md) for complete API documentation including all endpoints, request/response formats, and error handling.

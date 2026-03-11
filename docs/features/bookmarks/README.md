# Bookmarks Documentation

This folder contains comprehensive documentation for the Article Bookmarking System.

## Documentation Files

### [BOOKMARKS_API.md](./BOOKMARKS_API.md)
Complete API reference documentation including:
- All endpoints (Users & Bookmarks API)
- Request/response formats
- Error handling
- Validation rules
- Database schema
- Integration examples
- Best practices

**Start here** if you need detailed API specifications.

### [BOOKMARKS_QUICK_START.md](./BOOKMARKS_QUICK_START.md)
Quick reference guide with:
- Seed user credentials
- Common command examples
- Username validation rules
- Common error responses
- Testing workflows
- Database access commands

**Start here** if you want to quickly test the API.

### [BOOKMARKS_IMPLEMENTATION.md](./BOOKMARKS_IMPLEMENTATION.md)
Implementation details including:
- Database schema and migrations
- Module structure
- Service and controller implementations
- File organization
- Build status
- Future enhancements

**Start here** if you need to understand the codebase structure.

## Quick Links

- **Seed User ID:** `4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93`
- **Seed User Email:** `anahelenarp@hotmail.com`
- **Seed User Username:** `anahelena`

## Getting Started

1. Start the application: `pnpm run start:dev`
2. Get an article ID: `curl http://localhost:3000/api/articles | jq '.articles[0].id'`
3. Bookmark it:
```bash
curl -X POST http://localhost:3000/api/bookmarks \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93",
    "article_id": "YOUR_ARTICLE_ID"
  }'
```
4. View bookmarks:
```bash
curl "http://localhost:3000/api/bookmarks?user_id=4cbda1e9-15f0-44b4-87ca-c9cd63ecdb93"
```

## API Base URL

```
http://localhost:3000/api
```

## Key Features

- ✅ User management with email and username
- ✅ Bookmark articles for later reading
- ✅ Paginated bookmark lists with full article details
- ✅ Check bookmark status
- ✅ Track bookmark counts
- ✅ Comprehensive error handling
- ✅ PostgreSQL with full referential integrity
- ✅ UUID-based primary keys

## Need Help?

- For API details → See [BOOKMARKS_API.md](./BOOKMARKS_API.md)
- For quick testing → See [BOOKMARKS_QUICK_START.md](./BOOKMARKS_QUICK_START.md)
- For implementation → See [BOOKMARKS_IMPLEMENTATION.md](./BOOKMARKS_IMPLEMENTATION.md)

---
name: Add manual article endpoint
overview: Create a POST /articles endpoint that accepts a URL and scrapes a single article, similar to how briefing:tech scrapes articles from RSS feeds, but for a single manual URL.
todos:
  - id: create-dto
    content: Create CreateArticleDto with url (required) and feedProfile (optional, defaults to technology)
    status: pending
  - id: add-scraper-method
    content: Add scrapeSingleArticle method to ScraperService that fetches content, extracts title, and saves article
    status: pending
  - id: add-post-endpoint
    content: Add POST /api/articles endpoint to ArticlesController that uses the new scraper method
    status: pending
  - id: verify-module-deps
    content: Verify ScraperService is available to ArticlesController in the module
    status: pending
---

# Add Manual Article Endpoint

## Overview

Add a `POST /api/articles` endpoint that accepts a URL in the request body and scrapes that single article, saving it to the database similar to how `briefing:tech` processes RSS feed articles.

## Implementation Details

### 1. Create DTO for request payload

- **File**: `src/articles/dto/create-article.dto.ts` (new file)
- Create a DTO class with:
- `url: string` (required) - the article URL to scrape
- `feedProfile?: FeedProfile` (optional) - defaults to 'technology' if not provided

### 2. Add method to ScraperService for single article

- **File**: `src/scraper/scraper.service.ts`
- Add new method `scrapeSingleArticle(url: string, feedProfile: FeedProfile): Promise<number | null>`
- This method will:
- Check if article already exists using `articlesService.articleExists(url)`
- Fetch article content using existing `fetchArticleContentAndOgImage(url)`
- Extract title from HTML (using JSDOM) or use a fallback like "Untitled Article"
- Use current date as `publishedDate` (or try to extract from HTML meta tags)
- Use "Manual" as `feedSource`
- Call `articlesService.addArticle()` with the scraped data
- Return the article ID or null if article already exists

### 3. Add POST endpoint to ArticlesController

- **File**: `src/articles/articles.controller.ts`
- Add `@Post()` method that:
- Accepts the DTO from step 1
- Validates the URL format
- Calls `scraperService.scrapeSingleArticle()` with URL and feedProfile (defaulting to 'technology')
- Returns appropriate response with article ID or error message
- Handles errors gracefully (invalid URL, scraping failures, etc.)

### 4. Update module dependencies

- **File**: `src/articles/articles.module.ts`
- Ensure `ScraperService` is imported/available to `ArticlesController` (check if it's already available via shared modules)

## Key Implementation Points

- Reuse existing `ScraperService.fetchArticleContentAndOgImage()` method for content extraction
- Use existing `ArticlesService.addArticle()` for database persistence
- Follow the same pattern as RSS scraping but for a single URL
- Extract title from HTML `<title>` tag or use fallback
- Use current date/time as published_date (RSS feeds provide this, but manual articles won't have it)
- Set feed_source to "Manual" to distinguish from RSS-sourced articles
- Return article ID on success, appropriate error on failure
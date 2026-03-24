# Vector-Based Semantic Search for Articles

## Overview

This feature enables semantic search across articles using PostgreSQL's pgvector extension, allowing users to find conceptually related content that doesn't match exact keywords.

## Problem Statement

Users can only search articles using keyword matching (`LIKE` queries), which fails to find semantically related content when keywords don't match exactly. For example, searching "AI agents" won't find an article about "autonomous software assistants" even though they're the same concept.

## Solution

Implement pgvector extension in PostgreSQL, store article embeddings, and create a hybrid search API that combines keyword matching with semantic similarity for more relevant results.

## Technical Approach

### Embedding Model
- E5-large model via Together.xyz API (1024 dimensions)
- Embeddings generated from `title + processed_content`
- `passage:` prefix for article embeddings, `query:` prefix for search queries

### Search Modes
- **keyword** (default): Traditional LIKE-based search, no API calls
- **semantic**: Vector similarity search using cosine distance
- **hybrid**: Reciprocal Rank Fusion (RRF) combining keyword + semantic scores

### Database
- pgvector extension with IVFFlat index
- New `embedding_vector vector(1024)` column on articles table
- On-demand backfill via BullMQ queue

### API
- `GET /api/articles?mode=keyword|semantic|hybrid`
- Graceful fallback when embeddings missing

## Implementation Phases

### Phase 1: Database Schema
1. Create pgvector extension migration
2. Add `embedding_vector` column with IVFFlat index
3. Update DBArticle interface

### Phase 2: Queue Infrastructure
1. Add embedding queue constants and interface
2. Register queue in QueueModule
3. Create embedding generation processor with retry logic

### Phase 3: Vector Search
1. Add semantic search methods to ArticlesService
2. Implement RRF fusion algorithm
3. Add count methods for pagination

### Phase 4: Hybrid Search API
1. Update ListArticlesQuery with mode support
2. Add on-demand backfill trigger
3. Import AiModule in ArticlesModule

### Phase 5: Testing
1. Create test fixtures with pre-computed embeddings
2. Unit tests for vector methods and RRF
3. Processor retry logic tests
4. E2E tests for all search modes

## Key Files

| File | Purpose |
|------|---------|
| `src/database/migrations/*-AddVectorExtensionAndEmbeddingColumn.ts` | pgvector migration |
| `src/articles/articles.service.ts` | Vector search methods |
| `src/articles/queries/list-articles.query.ts` | Search mode handling |
| `libs/queue/processors/embedding-generation.processor.ts` | Background embedding generation |

## Configuration

- `EMBEDDING_API_KEY`: Together.xyz API key (existing)
- `RRF_K`: RRF constant (default: 60)

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits during backfill | High | Queue rate limiting, batch processing |
| IVFFlat accuracy with sparse vectors | Medium | Tune `lists` parameter as data grows |
| RRF tuning for result quality | Medium | Configurable k, A/B testing |

## Future Considerations

- Migrate to HNSW index when 10k+ vectors
- Batch embedding generation for bulk backfill
- YouTube transcriptions vector search (separate spec)

## References

- [Tech Spec](../../_bmad-output/implementation-artifacts/tech-spec-vector-semantic-search-articles.md)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [E5 Embedding Model](https://huggingface.co/intfloat/e5-large)
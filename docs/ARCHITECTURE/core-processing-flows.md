# Core Processing Flows

## Article flow

1. Article submitted manually or via external endpoint.
2. `ScraperService` stores base article data.
3. Job enqueued to `article-processing`.
4. Worker runs process -> rate -> categorize pipeline.
5. Optional audio generation can be requested per article.

## Markdown article flow

1. Client requests S3 upload URL.
2. Markdown file uploaded to S3.
3. Markdown processing job enqueued.
4. Worker downloads markdown, parses, creates article, then runs enrichment pipeline.

## YouTube transcription flow

1. Video submitted to `/api/youtube/transcriptions`.
2. Transcript extraction pipeline runs (primary + fallback services).
3. Summary job enqueued to `youtube-transcription-summary`.
4. Worker generates summary and updates transcription.
5. Optional audio job can be enqueued.

## Briefing generation flow

1. Fetch recent processed articles.
2. Cluster by embeddings.
3. Analyze clusters with AI.
4. Synthesize briefing markdown.
5. Persist briefing and metadata.

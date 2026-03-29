# Async Queue Architecture

Defined queue names:

- `article-processing`
- `markdown-article-processing`
- `youtube-transcription-summary`
- `audio-generation`

## Queue Producers

- `ArticlesController` -> `article-processing`, `markdown-article-processing`.
- `ExternalArticlesController` -> `article-processing`.
- `YoutubeTranscriptionsService` -> `youtube-transcription-summary`.
- `ProcessorService` and article-audio command handlers can request audio generation through `AudioJobService`.
- `YoutubeTranscriptionsController` and `YoutubeTranscriptionProcessor` request audio generation through `AudioJobService`.
- `AudioJobService` -> `audio-generation` (with dedupe/locking).

## Queue Consumers

- `libs/queue/processors/article.processor.ts` consumes `article-processing`
- `src/articles/processors/markdown-article.processor.ts` consumes `markdown-article-processing`
- `src/youtube-transcriptions/processors/youtube-transcription.processor.ts` consumes `youtube-transcription-summary`
- `libs/queue/processors/audio-generation.processor.ts` consumes `audio-generation`

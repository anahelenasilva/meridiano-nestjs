# ADR-0007: Extract ArticleProcessingPipelineModule as a Testable Seam

## Status
Accepted

## Context
The Article Summary -> Impact Rating -> categorisation flow lived inline in
`ProcessorService` (a ~436-line batch service) and was driven by the
`ArticleProcessor` Bull worker, which held the step orchestration and error
handling. That flow had no unit-testable interface: it could only be exercised
end-to-end against a real AI provider, database, and Redis queue, because the AI
calls, persistence, rate-limiting `setTimeout(1000)`, and the embedding-failure
email were all entangled in one loop.

Issue #116 (under parent #111) required a single entry point for processing one
article, testable in milliseconds with no real infrastructure.

## Decision
Extract `ArticleProcessingPipelineModule` (`src/processor/pipeline/`) whose only
public surface is `ArticleProcessingPipelineService.processArticle(article)`,
returning a typed `ProcessingResult`. The three steps are private methods.

The module depends on seams, not concrete infrastructure:

- **AI**: the service injects the `AiAdapter` interface (from ADR/#113) via the
  `AI_ADAPTER` token. The production binding is a `useFactory` in the module that
  wraps `AiService` (retaining provider selection, chunking, and retry policy)
  and throws on a null `chat`/`embed` result so failures reach the pipeline as
  step failures. The service never imports `AiService`.
- **Rate-limiting delay**: extracted behind the `Sleeper` interface (`SLEEPER`
  token). Production sleeps for `ConfigService.getArticleProcessingDelayMs()`
  (`ARTICLE_PROCESSING_DELAY_MS`, default 1000); tests inject a spy/no-op.
- **Failure notification**: extracted behind the `ProcessingNotifier` interface
  (`PROCESSING_NOTIFIER` token), implemented by `EmailProcessingNotifier`.
  Callers receive a typed failure result and never learn email is involved.

`ArticleProcessor` becomes a thin Bull adapter: fetch the job's article ->
`processArticle` -> ack on success / throw on failure. Audio job enqueueing
stays in the worker (the caller's responsibility), deliberately outside the
pipeline module, since audio generation is not part of Article Processing.

`ProcessorService` is unchanged and still serves the batch/manual processing
endpoints; only the per-article worker path was rerouted through the new module.

## Alternatives considered

**Keep orchestration in `ArticleProcessor`, inject `AiService` directly**
Rejected — depending on the concrete `AiService` is the exact coupling that made
the flow untestable without a real provider. The `AiAdapter` seam is the point.

**Make the pipeline a pure function returning results for the caller to persist**
Rejected — parent #111 mandates no behaviour change. The prior flow persisted
summary/rating/categories inline; moving persistence to the caller would spread
the logic back out and risk drift. The pipeline persists via `ArticlesService`
(a second, fakeable seam) and also returns the result.

**Notify only on embedding failure (prior behaviour)**
The original code emailed solely on embedding failure. We broadened the notifier
to fire on any step failure, matching #111's decision that error notification is
a first-class module responsibility. The email transport and config
(`getEmbeddingFailureNotificationEmail`) are unchanged.

## Consequences
- The pipeline is unit-tested against fakes (fake `AiAdapter`, spy `Sleeper`,
  fake `ProcessingNotifier`) with no provider, DB, or queue — happy path,
  partial failure (summary preserved when rate fails), notification, and the
  delay argument are all covered.
- `processArticle` takes a single `Article`; `feed_profile` is read from the
  article, not passed separately. The worker resolves the article by id.
- New failure paths email on rate/categorise failures too; if a narrower policy
  is wanted, constrain it inside `EmailProcessingNotifier`, not the pipeline.
- The `AI_ADAPTER` binding hand-wraps `AiService` in the composition root. When
  the AI Provider Adapter work (#113) exposes a first-class policy-wrapped
  `AiAdapter` provider, this factory should consume it instead.

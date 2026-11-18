# ADR-0011: Effect Inside AiPolicyService

## Status
Accepted, 2026-10-22. Amended by PR #400 (2026-11): text-to-speech calls carry
their typed error out to the audio worker, which decides BullMQ retries by tag.
Chat and embeddings keep the original boundary. Amended again (2026-11): the
policy retries only a socket that drops mid-body, and leaves every other retry to
the SDK clients.

## Context
`AiPolicyService.withRetry` decided what to retry by searching the error message
for `429`, `rate`, `timeout`, `ECONN`, `ETIMEDOUT` or `ECONNRESET`, then waited a
fixed 500ms. Every adapter calls the OpenAI or Groq SDK, and those SDKs word their
own network failures as `Connection error.` and `Request timed out.`, so neither
was retried, while any message containing `rate` was.

Issue #280 proposes using Effect for typed errors and declared retry policies,
starting with this service as a pilot, and keeping the NestJS shell (modules, DI,
controllers, BullMQ, TypeORM) as it is.

## Decision
Effect runs inside `src/ai/provider-error.ts` and `src/ai/ai-policy.service.ts`,
plus the text-to-speech path below. Adapters, `AiAdapter` and every other Nest
module stay Promise-based.

- **Typed provider errors.** `toProviderError` maps the SDKs' error classes to five
  tags: `RateLimited` (`RateLimitError`), `ProviderUnreachable`
  (`APIConnectionError`, or a `FetchError` whose `code` is `ECONNRESET`,
  `ECONNREFUSED` or `ETIMEDOUT`), `ProviderTimeout` (`APIConnectionTimeoutError`),
  `ProviderUnavailable` (`InternalServerError`, a 5xx) and `ProviderRejected`
  (everything else). It checks the OpenAI and Groq classes separately because they
  are distinct classes. The `FetchError` case covers a socket that drops while the
  adapter reads the response body, after the SDK has already returned.
- **Text-to-speech returns Effects up to the worker.**
  `AiPolicyService.generateAudio`, `AiService.generateAudio` and
  `GenerateAudioUseCase.execute` fail with typed errors instead of rejecting.
  `AudioGenerationProcessor` sorts each tag into retry or `UnrecoverableError` with
  one `RETRYABLE` table, which `satisfies` checks against the use case's inferred
  error union. This replaced regexes over a message that `AiService` had already
  rewrapped as a string. `ProviderNotConfigured` (no client because the API key is
  unset) joins the provider tags on this path.
- **One retry layer per failure.** The OpenAI and Groq clients keep their default
  `maxRetries: 2` and retry 408, 409, 429, 5xx, timeouts and connection errors,
  honouring `retry-after`. The policy retries only a `ProviderUnreachable` whose
  cause is a socket error (`isSocketError`), since that drop happens after the SDK
  has returned. It retries at most twice on `Schedule.exponential('500 millis')`
  with `Schedule.jittered`, which waits 400 to 600ms, then 800 to 1200ms. Retrying
  `RateLimited` and `APIConnectionError` here as well let one call make 9 HTTP
  requests.
- **No Effect timeout.** `CHAT_MAX_TOKENS` defaults to 8192, so a legitimate
  completion can outlast the 30s the issue suggests. `AiAdapter` takes no
  `AbortSignal` either, so an Effect timeout would stop waiting while the HTTP
  request kept running and billing.
- **The boundary rejects with the original error.** `withRetry` maps each tag back
  to its `cause` and runs the program through `runPromiseOrThrow`
  (`src/ai/run-effect.ts`), which uses `Effect.runPromiseExit` and throws
  `Cause.squash` of a failure. The pipeline's `AI_ADAPTER.generateAudio` uses the
  same helper but keeps the tag, so it rejects with the tagged error. `Effect.runPromise` would reject with a
  `FiberFailure` wrapper instead. Callers such as `AiService.callChatOrThrow` keep
  the provider's own message.
- **`effect` 3.21.2.** `@ai-hero/sandcastle` already installs 3.21.2, and 12 of its
  `@effect/*` packages take `effect` (`^3.20.0`) as a peer resolved from the root.
  Pinning the same version keeps one Effect in the tree. 3.x ships CommonJS, so the
  build, Jest and ESLint need no changes.
- **Tests stay in Jest.** Fake timers drive Effect's schedule, so retry tests do not
  wait in real time.

## Alternatives considered

**`effect` 4.x**
Rejected. It is the current major, but a root `effect@4` becomes the peer of
sandcastle's `@effect/*` packages, and `@ai-hero/sandcastle` then fails to import
(`effect/dist/FiberRef.js` is gone in 4.x). Neither `resolvePeersFromWorkspaceRoot:
false` nor scoped `overrides` re-bind those auto-installed peers. 4.x also ships
only ES modules, which needed Jest transform changes and Node 22.12 for
`require(esm)`.

**Adapters that return Effects**
Rejected for the pilot. It changes `AiAdapter`, which ADR-0007's `AI_ADAPTER`
factory implements, so the pipeline would change too. The text-to-speech path
starts its Effect in `AiPolicyService` and leaves `AiAdapter` Promise-based.

**A 30s `Effect.timeout` per attempt**
Rejected for the reasons under "No Effect timeout".

**`TestClock` with `@effect/vitest`**
Rejected. It adds a second test runner for one service.

## Consequences
- A 429 waits on the SDK's backoff (`retry-after` when under 60s, else about 0.5s,
  then 1s) and gets 3 requests in total. The audio worker's BullMQ attempt still re-runs the whole job
  for retryable tags.
- If the pilot holds, #280's next step is the article processing pipeline, where
  Effect's error channel and clock would replace `StepResult` and the `Sleeper`
  seam from ADR-0007.
- Moving to Effect 4 waits for sandcastle to move. Both upgrade together.

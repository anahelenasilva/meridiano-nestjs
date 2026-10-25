# ADR-0011: Effect Inside AiPolicyService

## Status
Accepted, 2026-10-22.

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
Effect runs inside `src/ai/provider-error.ts` and `src/ai/ai-policy.service.ts`
only. Adapters, `AiAdapter`, `AiService` and every Nest module stay Promise-based.

- **Typed provider errors.** `toProviderError` maps the SDKs' error classes to four
  tags: `RateLimited` (`RateLimitError`), `ProviderUnreachable`
  (`APIConnectionError`), `ProviderTimeout` (`APIConnectionTimeoutError`) and
  `ProviderRejected` (everything else). It checks the OpenAI and Groq classes
  separately because they are distinct classes.
- **Declared retry policy.** `RateLimited` and `ProviderUnreachable` retry at most
  twice on `Schedule.exponential('500 millis')` with `Schedule.jittered`, which
  waits 400 to 600ms, then 800 to 1200ms.
- **Timeouts are not retried.** The SDK already retried a timed-out request twice
  before it throws, with a 600s client timeout for OpenAI and 60s for Groq. A policy
  retry on top would let one chat call wait up to 3 × 3 × 600s. A connection error
  ends before that timeout fires, so it is retried.
- **No Effect timeout.** `CHAT_MAX_TOKENS` defaults to 8192, so a legitimate
  completion can outlast the 30s the issue suggests. `AiAdapter` takes no
  `AbortSignal` either, so an Effect timeout would stop waiting while the HTTP
  request kept running and billing.
- **The boundary rejects with the original error.** `withRetry` maps each tag back
  to its `cause`, runs the program with `Effect.runPromiseExit` and throws
  `Cause.squash` of a failure. `Effect.runPromise` would reject with a
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
factory implements, so the pipeline would change too.

**A 30s `Effect.timeout` per attempt**
Rejected for the reasons under "No Effect timeout".

**`TestClock` with `@effect/vitest`**
Rejected. It adds a second test runner for one service.

## Consequences
- The SDKs still retry 408, 409, 429, 5xx and connection errors twice on their own,
  so a rate-limited or unreachable call can make up to 9 HTTP requests. Dropping the policy retry,
  or setting the clients' `maxRetries` to 0, would leave one layer in charge.
- If the pilot holds, #280's next step is the article processing pipeline, where
  Effect's error channel and clock would replace `StepResult` and the `Sleeper`
  seam from ADR-0007.
- Moving to Effect 4 waits for sandcastle to move. Both upgrade together.

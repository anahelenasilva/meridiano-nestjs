# ADR-0008: DeepSeek Thinking Disabled by Default and Reasoning-Token Budget

## Status
Accepted

## Context
`deepseek-v4-flash` (the default chat model) is a reasoning model. Its reasoning tokens are billed inside `completion_tokens`, which `max_tokens` caps. The chat `max_tokens` was `2048`, a value sized for the older non-reasoning `deepseek-chat`. On complex articles the model spent the entire budget on chain-of-thought and emitted zero content tokens (`finish_reason: length`), so the summarise step failed with the opaque `AI chat returned no content`. The empty result was swallowed (`callChat` returns `null`, the pipeline converts `null` to a generic message), so neither the real cause nor `finish_reason` reached the logs.

Every current chat caller is a summarise, extract, classify, or rank task: article summarise/rate/categorise, YouTube transcription summaries and chunk structure extraction, cluster and transcription analysis, briefing synthesis/custom briefing/title, daily-digest article selection, and markdown source extraction (ADR-0003). None require multi-step reasoning, and several return strict JSON where chain-of-thought can leak into the response body.

## Decision
Run DeepSeek chat with thinking mode disabled by default, and size the completion budget for a reasoning model.

- **Thinking off by default.** DeepSeek chat calls send `thinking: { type: 'disabled' }` in the request body. The field is DeepSeek-specific, so it is passed through a generic `extraBody` parameter on the shared `openai-compatible-chat` helper; the OpenAI adapter never receives it. The default lives in `DeepseekAdapter`. A future caller that benefits from reasoning can opt back in by omitting `extraBody`.
- **Budget sized for the model.** Default chat `maxTokens` raised from `2048` to `8192`. Both the chat model and the token budget are now env-overridable (`DEEPSEEK_CHAT_MODEL`, `CHAT_MAX_TOKENS`), matching the existing `EMBEDDING_MODEL` override; previously the chat model could not be changed without a rebuild.
- **Diagnosable failures.** The empty-response error now includes `finish_reason`, so budget exhaustion is visible in logs.

The disable wire format was verified against DeepSeek's thinking-mode documentation: `thinking.{type: "disabled"}` sits at the top level of the request body, which is what the `openai-node` passthrough produces.

## Alternatives considered

**Leave thinking on and raise `max_tokens` much higher (16k or more)**
Rejected. It pays for chain-of-thought that these tasks discard, adds latency and cost, can still overrun a pathological article, and leaves CoT free to leak into the JSON-output calls (digest selection, structure extraction).

**Switch to a non-reasoning model such as `deepseek-chat`**
Rejected. `deepseek-chat` is a retiring alias that routes to `deepseek-v4-flash` in non-thinking mode and is scheduled for retirement in mid-2026. `deepseek-v4-flash` is the model DeepSeek recommends for chat, summaries, and high-volume pipelines. Disabling thinking on `v4-flash` gives the same non-reasoning behavior without depending on a deprecated alias.

**Enable thinking only for specific calls**
Deferred. No current caller benefits. Keep the default off and add per-call opt-in when a real need appears; daily-digest ranking is the likely first candidate.

## Consequences
- The summarise step no longer fails from budget-exhaustion empty content, at lower cost and latency (no CoT tokens produced or paid for).
- A new generic `extraBody` seam exists on the shared `openai-compatible-chat` helper for provider-specific body fields. The OpenAI path is unaffected.
- Two new env overrides, `DEEPSEEK_CHAT_MODEL` and `CHAT_MAX_TOKENS`, are documented in `.env.sample`. Defaults are `deepseek-v4-flash` and `8192`.
- The thinking-off default lives in `DeepseekAdapter`, not per call. True per-call control would require threading a flag through `callChat` to the policy layer to the adapter (an interface change), deferred until a caller needs it.
- `finish_reason` now surfaces in the empty-response error. `callChat` still collapses provider errors to `null` upstream; that contract is tracked separately and is not changed here.

Implemented in PR #192. The bug surfaced in the article-processing pipeline seam described in ADR-0007.

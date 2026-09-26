# 0010. Embeddings on OpenAI text-embedding-3-small

## Status

Accepted, 2026-09-19.

## Context

Together.ai stopped serving `intfloat/multilingual-e5-large-instruct` serverless.
Every embedding call returned a 400, and articles went unclustered. The only
serverless embedding model Together still offers is `BAAI/bge-base-en-v1.5`, which is
English-only, and the `brasil` feed is Portuguese. A dedicated Together endpoint
would keep e5 but bills for an always-on instance.

## Decision

Embeddings come from OpenAI `text-embedding-3-small` (1536 dims, 8191-token input)
through `OpenAIAdapter`. `OPENAI_API_KEY` is now required; `EMBEDDING_API_KEY` and the
Together adapter are gone. `EMBEDDING_MODEL` still overrides the model name.

## Consequences

- Vectors from different models are not comparable. After any model change, run
  `pnpm reembed` so every processed article shares one space.
- The Standard Briefing candidate pool keeps only the most common embedding
  dimension and warns about the rest, so briefings degrade instead of clustering
  garbage during a switch.
- One provider now serves chat (optional), TTS and embeddings. An OpenAI outage
  stops embeddings.

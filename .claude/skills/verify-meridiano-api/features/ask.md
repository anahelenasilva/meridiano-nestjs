# Ask

A signed-in user asks a question about one article or YouTube transcription and gets a Markdown answer from a chosen chat model. The server keeps no conversation state; the client sends earlier turns as `history`.

## Sub-features

- `ask-models` lists the models an Ask can use (`GET /api/ask/models`).
- `ask-answer` answers about a source with the default model.
- `ask-model` answers with a model picked from the list and reports it back in `model`.
- `ask-history` accepts up to 20 earlier turns.
- `ask-validation` rejects a blank question, an unknown model and a non-UUID source.
- `ask-missing-source` returns 404 for a UUID that matches no source.

## How to get to it (user POV)

- Frontend: the Ask panel on an article or transcription page.
- Any client: `POST /api/ask` with a JWT.

## Driving it with api.sh

Preconditions:

- Baseline from the README, and an article id `A` (see notes.md).
- At least one provider key in `.env` for a model `GET /api/ask/models` lists.

- **Models.** `EXPECT=200 $S/api.sh ask-models GET /api/ask/models | jq -c .`. A non-empty array of `{id, ...}`. Pick the cheapest id as `M`.
- **Answer.** `EXPECT=200 $S/api.sh ask-answer POST /api/ask '{"source_type":"article","source_id":"<A>","question":"In one sentence, what is this about?","model":"<M>"}' | jq -c '{model, truncated, answer: (.answer[0:200])}'`. `model` equals `M` and `answer` is non-empty.
- **History.** Repeat with `"history":[{"question":"In one sentence, what is this about?","answer":"<previous answer>"}]` and a follow-up question. 200 with an answer that builds on the first.
- **Blank question.** `EXPECT=400 $S/api.sh ask-blank POST /api/ask '{"source_type":"article","source_id":"<A>","question":"  "}'`. Message `question must not be empty`.
- **Unknown model.** `EXPECT=400 $S/api.sh ask-bad-model POST /api/ask '{"source_type":"article","source_id":"<A>","question":"hi","model":"nope"}'`. Message starts `model must be one of`.
- **Missing source.** `EXPECT=404 $S/api.sh ask-missing POST /api/ask '{"source_type":"article","source_id":"00000000-0000-4000-8000-000000000000","question":"hi"}'`.

## Gotchas

- Every answer is a paid provider call. Run `ask-answer` and `ask-history` once each, only when the change touches Ask or `AiService`.
- A provider failure returns 502, not 500. A 502 here is a provider or key problem, so check `server.log` before calling it a regression.
- `truncated` is true for long sources; that is expected, not a failure.

# Notes

A signed-in user keeps one note per article or YouTube transcription: saving replaces it, appending adds text after a blank line, saving empty text clears it, and list views show the note on its source. A note holds at most 20,000 characters.

## Sub-features

- `notes-save` replaces the note content (`POST /api/notes`).
- `notes-append` adds text after a blank line, creating the note when absent (`POST /api/notes/append`).
- `notes-read-back` shows the note under `note` on its article in `GET /api/articles`.
- `notes-cap` accepts exactly 20,000 characters and rejects a save or append past it.
- `notes-blank-append` rejects whitespace-only appends.
- `notes-clear` soft-deletes the note when saved with empty content.

## How to get to it (user POV)

- Frontend: the note editor on an article or transcription page.
- CLI or any client: `POST /api/notes` and `POST /api/notes/append` with a JWT.

## Driving it with api.sh

Preconditions:

- Baseline from the README.
- An article id `A`: `EXPECT=200 $S/api.sh pick-article GET '/api/articles?perPage=1&archive_scope=all' | jq -r '.articles[0] | .id, .title, .note'`. Its `note` is `null` for the verify user.

- **Save.** `EXPECT=201 $S/api.sh notes-save POST /api/notes '{"source_type":"article","source_id":"<A>","content":"verify: first line"}'`. Response `note.content` is `verify: first line`.
- **Append.** `EXPECT=201 $S/api.sh notes-append POST /api/notes/append '{"source_type":"article","source_id":"<A>","content":"verify: second line"}'`. Response `note.content` is `verify: first line\n\nverify: second line`, same `note.id`.
- **Read back.** `EXPECT=200 $S/api.sh notes-read-back GET '/api/articles?perPage=5&archive_scope=all&searchTerm=<url-encoded words from the title>' | jq -c '[.articles[] | select(.id=="<A>") | .note]'`. Shows the appended content.
- **Blank append.** `EXPECT=400 $S/api.sh notes-append-blank POST /api/notes/append '{"source_type":"article","source_id":"<A>","content":"   "}'`. Message `content must not be blank`.
- **Cap bodies.** `for n in 20000 20001; do jq -nc --arg a "<A>" --arg c "$(head -c $n /dev/zero | tr '\0' x)" '{source_type:"article",source_id:$a,content:$c}' > "$VERIFY_RUN/note-$n.json"; done`.
- **Save at cap.** `EXPECT=201 $S/api.sh notes-save-at-cap POST /api/notes "@$VERIFY_RUN/note-20000.json" | jq '.note.content | length'` prints `20000`.
- **Append over cap.** `EXPECT=400 $S/api.sh notes-append-over-cap POST /api/notes/append '{"source_type":"article","source_id":"<A>","content":"y"}'`. Message `Note would exceed 20000 characters`.
- **Save over cap.** `EXPECT=400 $S/api.sh notes-save-over-cap POST /api/notes "@$VERIFY_RUN/note-20001.json"`. Message `content must not exceed 20000 characters`.
- **Clear.** `EXPECT=201 $S/api.sh notes-clear POST /api/notes '{"source_type":"article","source_id":"<A>","content":""}'` returns `{"note":null}`, and the read-back request now shows `[null]`.
- **Side effect.** `$S/sql.sh notes-db "select n.id, length(n.content) as len, n.deleted_at is not null as deleted from notes n join users u on u.id = n.user_id where u.email = 'verify@meridiano.local' and n.source_id = '<A>'"`. The latest row has `len` 20000 and `deleted` true.

## Gotchas

- Clearing is a soft delete: rows stay with `deleted_at` set, and each run adds one. Filter `sql.sh` queries on `deleted_at` or the latest `created_at`.
- `GET /api/articles` attaches notes only for a JWT user. With `AUTH=apikey` every `note` is `null`, which proves nothing.
- `searchTerm` must match the title; pick distinctive words or the article falls off the first page.
- Transcription notes use `source_type` `transcription` and read back through `GET /api/youtube/transcriptions`; that path has not been driven yet.

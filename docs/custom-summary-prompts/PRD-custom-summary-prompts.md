# Product Requirements Document - Meridiano: Custom Summary Prompts

## Executive Summary

Meridiano's article and YouTube transcription pipelines use feed-profile-based prompts for AI summarization. All content within a profile receives identical summarization treatment. This feature adds an optional per-item custom instruction that appends to the base prompt, giving the user contextual control over how individual items are summarized. The instruction is persisted alongside the processed content for traceability.

### What Makes This Special

Default summarization works for most content. But a tutorial needs step extraction, a tool review needs applicability analysis, and a deep-dive needs a different lens than a news piece. This feature lets the user express per-item summarization intent with zero friction — an optional text field at creation time — while preserving full pipeline compatibility.

## Project Classification

| Field            | Value       |
| ---------------- | ----------- |
| **Project Type** | api_backend |
| **Domain**       | general     |
| **Complexity**   | low         |
| **Context**      | brownfield  |

## Success Criteria

### User Success

* User can provide a custom instruction when adding an article or YouTube video
* The resulting summary visibly reflects the custom instruction (e.g., tutorial steps are listed, tool applicability is analyzed)
* User can see what custom instruction was used for any article or transcription

### Business Success

* Feature used on \~10% of added items (confirms the need exists without over-engineering)
* No degradation in processing pipeline reliability or speed

### Technical Success

* Custom instruction appends cleanly to existing prompt templates without breaking default behavior
* Zero impact on items added without a custom instruction
* Instruction prompt field persisted and retrievable via API

### Measurable Outcomes

* Articles/transcriptions created with custom instructions produce summaries that differ meaningfully from default summaries of the same content
* Pipeline error rate remains unchanged after feature deployment
* API response contracts remain backward-compatible

## Product Scope

### MVP - Minimum Viable Product

* Optional `customPrompt` field on article creation and YouTube transcription creation endpoints
* Append custom instruction to base prompt during AI summarization
* Persist the custom instruction on the `articles` and `youtube_transcriptions` records
* Return the custom instruction in GET responses for articles and transcriptions

### Growth Features (Post-MVP)

* Prompt templates library — save and reuse common instructions (e.g., "tutorial mode", "tool review mode")
* Bulk-apply a custom instruction to multiple items
* Custom instruction support for briefing generation

### Vision (Future)

* Auto-detect content type (tutorial, review, news) and suggest appropriate instructions
* Per-profile default custom instructions

## User Journeys

### Journey 1: Adding an Article with Custom Instruction

**Opening:** User finds a tutorial article about setting up Kubernetes with Helm. The default summary would give a generic overview, but the user wants structured steps and tool names.

**Action:** User calls `POST /api/articles` with the URL, feed profile, and `customPrompt`: "Extract step-by-step instructions and list all tools, CLI commands, and versions mentioned."

**Climax:** The processing pipeline appends the custom instruction to the feed profile's base prompt. The AI generates a summary with numbered steps, tool names, and commands.

**Resolution:** The article is stored with both the tailored summary and the custom instruction. When the user revisits the article via API, they see the summary and remember exactly what angle they asked for.

### Journey 2: Adding a YouTube Video with Custom Instruction

**Opening:** User finds a video reviewing an AI coding tool. The default transcription summary would give a general overview, but the user wants to know how to apply it to their NestJS workflow.

**Action:** User calls `POST /api/youtube/transcriptions` with the URL, channel ID, and `customPrompt`: "Focus on features relevant to NestJS backend development. List practical use cases."

**Climax:** The transcription is extracted, and the summary job uses the base prompt plus the custom instruction. The summary highlights NestJS-relevant features.

**Resolution:** The transcription record stores the custom instruction alongside the summary. The user can later see both the summary and the instruction that shaped it.

### Journey 3: Adding Content Without Custom Instruction (Unchanged)

**Opening:** User adds a routine news article.

**Action:** User calls `POST /api/articles` with URL and feed profile only. No `customPrompt` provided.

**Resolution:** Pipeline behaves exactly as today. No custom instruction stored. Full backward compatibility.

### Journey 4: Viewing a Previously Customized Article

**Opening:** Weeks later, user browses their articles and finds a tutorial summary with unusually detailed steps.

**Action:** User calls `GET /api/articles/:id`. The response includes `custom_prompt`: "Extract step-by-step instructions and list all tools..."

**Resolution:** User immediately remembers the angle they requested. They can reuse the same instruction for a similar article in the future.

### Journey Requirements Summary

| Journey | Capabilities Revealed                                                  |
| ------- | ---------------------------------------------------------------------- |
| 1 & 2   | Accept optional custom instruction at creation time                    |
| 1 & 2   | Append instruction to base prompt during AI processing                 |
| 1 & 2   | Persist instruction on the record                                      |
| 3       | Backward compatibility — field is optional, default behavior unchanged |
| 4       | Return stored instruction in API responses                             |

## API Backend Specific Requirements

### Endpoint Changes

`POST /api/articles` — Add optional `customPrompt` string field to request body.

`POST /api/youtube/transcriptions` — Add optional `customPrompt` string field to request body.

`GET /api/articles/:id` — Include `custom_prompt` in response when present.

`GET /api/articles` — Include `custom_prompt` in list response items when present.

`GET /api/youtube/transcriptions/:id` — Include `custom_prompt` in response when present.

`GET /api/youtube/transcriptions` — Include `custom_prompt` in list response items when present.

### Database Schema Changes

`articles` table — Add nullable `custom_prompt` column (type: `text`).

`youtube_transcriptions` table — Add nullable `custom_prompt` column (type: `text`).

Both require TypeORM migrations.

### Processing Pipeline Changes

**Article Processing Processor** — When `custom_prompt` is present on the article record, append it to the base feed-profile prompt before calling the AI summarization service.

**YouTube Transcription Summary Processor** — When `custom_prompt` is present on the transcription record, append it to the base prompt before calling the AI summarization service.

### Prompt Concatenation Logic

```
Final prompt = base_profile_prompt + "\n\nAdditional instructions: " + custom_prompt
```

If `custom_prompt` is null or empty, the final prompt equals the base prompt exactly. No behavioral change.

### Data Flow

```
User Request (with optional customPrompt)
    → Controller validates input
    → Service saves record with custom_prompt field
    → Job queued with reference to record ID
    → Processor fetches record, reads custom_prompt
    → Prompt concatenation: base + custom instruction
    → AI summarization with combined prompt
    → Summary stored on record
    → Record retrievable via GET with custom_prompt visible
```

### Implementation Considerations

* `customPrompt` must pass through the queue job. Since processors already fetch the full record by ID, the custom_prompt is available without changing job payload structure.
* No changes to BullMQ queue definitions or job data schemas needed — the prompt is read from the database record, not the job payload.
* Prompt concatenation should be handled in a single utility function shared by both processors for consistency.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Approach:** Problem-solving MVP — deliver the core capability with minimal surface area change.

### MVP Feature Set (Phase 1)

**Core Capabilities:**

* Optional `customPrompt` field on both creation endpoints
* Prompt concatenation in both processing pipelines
* Schema migration for both tables
* Field returned in all relevant GET responses

**Must-Have:**

* Backward compatibility — empty/missing `customPrompt` = identical behavior to today
* Custom instruction persisted permanently on the record
* Combined prompt produces meaningfully different summaries

### Post-MVP Features

**Phase 2 (Growth):**

* Prompt templates library (save, name, and reuse common instructions)
* Filter articles/transcriptions by "has custom prompt"

**Phase 3 (Expansion):**

* Auto-suggest instructions based on content type detection
* Custom instructions for briefing generation overrides

### Risk Mitigation Strategy

| Risk                                                     | Likelihood | Impact | Mitigation                                                                  |
| -------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------- |
| Custom instruction produces worse summaries than default | Medium     | Low    | User controls when to use it; default unchanged                             |
| Very long custom instructions exceed AI token limits     | Low        | Medium | Validate max length on input (e.g., 500 chars)                              |
| Prompt injection via custom instruction                  | Low        | Low    | Single-user system; user is the admin. Monitor if multi-user is added later |

## Functional Requirements

### Article Management

* FR1: User can provide an optional custom prompt when creating an article via URL
* FR2: User can provide an optional custom prompt when creating an article via markdown upload
* FR3: System appends the custom prompt to the feed profile's base prompt during article AI summarization
* FR4: System persists the custom prompt on the article record
* FR5: User can view the custom prompt for any article via the article detail endpoint
* FR6: User can view the custom prompt in article list responses

### YouTube Transcription Management

* FR7: User can provide an optional custom prompt when creating a YouTube transcription
* FR8: System appends the custom prompt to the base prompt during transcription AI summarization
* FR9: System persists the custom prompt on the transcription record
* FR10: User can view the custom prompt for any transcription via the transcription detail endpoint
* FR11: User can view the custom prompt in transcription list responses

### Backward Compatibility

* FR12: Articles created without a custom prompt behave identically to current behavior
* FR13: Transcriptions created without a custom prompt behave identically to current behavior
* FR14: Existing articles and transcriptions return null for custom_prompt field

### Prompt Processing

* FR15: System concatenates base prompt and custom prompt with a clear delimiter
* FR16: System uses a shared utility function for prompt concatenation across both pipelines

### Validation

* FR17: System accepts custom prompt as an optional text field up to 500 characters
* FR18: System rejects custom prompts exceeding the maximum length with a 400 error

## Non-Functional Requirements

### Performance

* Adding a custom prompt adds zero measurable latency to the creation endpoint (it's just an additional text field saved to the database)
* AI summarization time may vary based on combined prompt length, but remains within existing processing timeout thresholds

### Reliability

* Pipeline error rate remains unchanged for items without custom prompts
* Pipeline retries and error handling behave identically regardless of custom prompt presence

### Backward Compatibility

* All existing API consumers continue to work without modification
* New `custom_prompt` field is additive — no existing fields removed or renamed
* Database migration is non-destructive (nullable column addition)

---

## Summary

This PRD defines a focused enhancement to Meridiano's article and YouTube transcription pipelines. The feature adds an optional `customPrompt` field to creation endpoints, appends it to base prompts during AI summarization, persists it on the record, and returns it in API responses. It comprises:

* **18 functional requirements** across 5 capability areas
* **2 database migrations** (one per table)
* **2 endpoint modifications** (creation) + **4 response modifications** (list and detail)
* **1 shared utility** for prompt concatenation
* **Full backward compatibility**

## Next Steps

1. **Architecture:** Schema migrations for `articles` and `youtube_transcriptions` tables — add nullable `custom_prompt` text column
2. **Epic/Story Breakdown:** Use FRs 1–18 to create implementable stories. Suggested grouping:
   * Story 1: Database migrations (FR4, FR9, FR14)
   * Story 2: Article creation + processing changes (FR1, FR2, FR3, FR4, FR15, FR16, FR17, FR18)
   * Story 3: Transcription creation + processing changes (FR7, FR8, FR9, FR15, FR16, FR17, FR18)
   * Story 4: GET endpoint response updates (FR5, FR6, FR10, FR11)
   * Story 5: Backward compatibility verification (FR12, FR13, FR14)
3. **Implementation:** All changes trace back to the FRs documented here. Any feature not listed will not exist unless explicitly added.
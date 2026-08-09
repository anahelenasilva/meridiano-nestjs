# Meridiano

A content briefing platform that curates and synthesises articles from a user's feed profile into readable briefings.

## Language

### Briefings

**Standard Briefing**:
A briefing where the system selects articles automatically based on the user's feed profile.
_Avoid_: regular briefing, auto briefing, normal briefing

**Curated Briefing**:
A briefing where the user explicitly selected which articles to include.
_Avoid_: custom briefing — the codebase used "custom" for this flow (`isCustom`, `CustomBriefingProcessor`), but "custom" also appeared for prompt overrides; "curated" is unambiguous

**Feed Profile**:
A named topic category that drives article selection and AI prompt tuning for Standard Briefings. Profiles include general topics (`TECHNOLOGY`, `POLITICS`, `BUSINESS`, `HEALTH`, `SCIENCE`), regional news (`BRASIL` — Brazilian news), and branded sources (`TECLAS` — technology and labour-class politics, sourced from the Teclas newsletter/YouTube channel). `DEFAULT` is the fallback profile.

**Briefing Title**:
A human-readable label for a briefing, editable at any time. Auto-generated as a convenience during Curated Briefing creation; the auto-generated value is not semantically distinct from a user-set one.
_Avoid_: customTitle

**Generation Prompt Overrides**:
Developer/power-user parameters (`clusterAnalysis`, `briefSynthesis`) that replace the default AI prompts used internally during Standard Briefing generation. Not exposed to end users.
_Avoid_: customPrompts, custom prompts

**Briefing Focus Instruction**:
A free-text user instruction passed when creating a Curated Briefing that shapes the tone or angle of the output (e.g. "focus on the business impact").
_Avoid_: customPrompt, prompt

**Article Cluster**:
A group of articles about the same sub-topic, identified during Standard Briefing generation. Clusters affect how articles are synthesised (grouped narrative) but do not filter which articles are included.
_Avoid_: topic group, category

**Article Summary**:
An AI-generated condensation of a raw article's body, produced by the article processor before briefing generation. Briefing generation skips articles where the summary is absent. Stored as `processed_content` in the database.
_Avoid_: processed_content, processed article

**Impact Rating**:
An AI-assigned editorial score indicating how important an article is, based on criteria defined in the feed profile's impact prompt. Not a relevance-to-profile score — it reflects newsworthiness/significance as the domain expert would judge it.
_Avoid_: relevance score, priority score

### News Digest

**News Digest**:
A daily, AI-selected shortlist of the previous day's most relevant articles, delivered by email on a scheduled queue job. Distinct from a Briefing: it is not synthesised prose but a ranked list of articles, and it is not tied to a single feed profile. Each run is persisted as an immutable snapshot so it can be read back without re-running the selection.
_Avoid_: daily briefing, digest email (the email is the delivery channel, not the digest itself)

**Digest Item**:
A single entry in a News Digest — one selected article captured as a snapshot at selection time: its article id, title, feed source, and url. Because it is a snapshot, later deleting or re-processing the source article does not change a past digest.
_Avoid_: digest article, digest entry

### YouTube

**YouTube Transcription**:
A transcript of a YouTube video, processed independently from the article pipeline. Never included in Standard or Curated Briefings — a separate content type with its own flow.
_Avoid_: article, content item (when referring to transcriptions)

### Email Delivery

**Daily Digest**:
A scheduled email containing the top 10 TECHNOLOGY articles from the previous day, selected by AI based on a personal relevance prompt. Not a Briefing — no Briefing entity is created. Delivered to the owner each morning; the app UI is not involved in rendering or displaying it.
_Avoid_: briefing digest, news briefing (it is not a Briefing in the domain sense)

### Articles & Reading

**Audio Summary**:
A text-to-speech audio rendering of an Article Summary. Belongs to an article, not a briefing.
_Avoid_: audio briefing, audio file, TTS file

**Article**:
A piece of written content ingested into the platform. Sources include RSS feeds, website URLs (scraped), and uploaded markdown files (for non-public or unscrappable sites). YouTube transcriptions are not Articles.
_Avoid_: content item, post (unless quoting a source)

**Article Source**:
The publication or author attribution stored on an Article. For RSS-ingested articles it is the feed name (e.g. `"Will Larson"`, `"TechCrunch"`). For manually scraped URLs it is `"Manual"`. For uploaded markdown articles it is extracted from the document content via AI; falls back to `"Unknown"` when no author can be identified. `"Unknown"` is a meaningful sentinel — it means extraction was attempted and failed, distinct from legacy `"S3 Upload"` records created before this feature existed.
_Avoid_: author (too narrow — covers publications, not just people), feed_source (implementation column name)

**Bookmark**:
An article saved by the user to read later. Not a saved briefing.
_Avoid_: saved article, favourite, starred

## Scope

Meridiano is intentionally single-user. The owner is the only operator; there is no concept of tenancy or per-user data isolation in the current model. Multi-user support is planned but deferred. See ADR-0001.

## Relationships

- An **Article** has one **Article Summary** (absent until processed) and one optional **Audio Summary**
- An **Article** has one optional **Impact Rating**, assigned during processing
- A **Standard Briefing** draws from **Articles** filtered and grouped into **Article Clusters** by **Feed Profile**
- A **Curated Briefing** draws from an explicit set of **Articles** supplied by the user
- A **Bookmark** references an **Article**
- A **YouTube Transcription** is independent — it shares no pipeline with **Articles** or **Briefings**

## Example dialogue

> **Dev:** "Should the **Impact Rating** filter which articles go into a **Standard Briefing**?"
> **Domain expert:** "It can influence selection order, but the **Article Cluster** step doesn't filter by it — clustering is purely about sub-topic grouping."

> **Dev:** "Can I create a **Curated Briefing** from a **YouTube Transcription**?"
> **Domain expert:** "No — transcriptions are a separate content type. Only **Articles** can go into a **Curated Briefing**."

## Flagged ambiguities

- `isCustom` flag was ambiguous — resolved: it marks a **Curated Briefing** (user chose the articles), not a style or prompt customisation
- `customTitle` was ambiguous — resolved: it is the **Briefing Title**, a single concept regardless of whether it was auto-generated or user-set
- `customPrompt` (singular, Curated Briefing) vs `customPrompts` (plural, Standard Briefing) are different concepts — resolved as **Briefing Focus Instruction** and **Generation Prompt Overrides** respectively
- `simple` flag and `GenerateSimpleBriefUseCase` are dead code — not a domain concept, safe to delete

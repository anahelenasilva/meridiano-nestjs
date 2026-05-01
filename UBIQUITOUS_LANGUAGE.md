# Ubiquitous Language

## Content Sources

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Article** | A news or blog item scraped from RSS feeds or manually submitted | Post, story, item |
| **RSS Feed** | A syndicated content source configured for automated article discovery | Feed, source |
| **Feed Profile** | A thematic categorization of content sources (technology, politics, business, etc.) | Profile, feed type |
| **Feed Configuration** | The settings object that defines a Feed Profile's RSS feeds, prompts, and processing settings (new) | Feed settings, profile config |
| **YouTube Channel** | A configured video channel for transcription extraction | Channel, video source |
| **Scraper** | The component that fetches articles from RSS feeds | Crawler, fetcher |
| **External Article** | An article submitted via the public API endpoint using a token, subject to rate limiting (new) | Public article, submitted article |

## Content Processing

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Processing** | The act of generating a Summary and Embedding for an article's raw content using AI | Analyzing, digesting |
| **Summary** | The AI-generated condensed text of an article or transcription (stored as `processed_content` in the DB) (new) | processed_content, digest, analysis |
| **Embedding** | A vector representation of a Summary for semantic clustering | Vector, encoding |
| **Impact Rating** | A 1-10 score assigned by AI to rate article significance | Rating, score, importance |
| **Category** | An article classification (news, blog, research, tutorial, etc.) | Classification, tag, type |
| **Cluster** | A group of semantically related articles grouped by k-means on their Embeddings | Group, topic cluster |
| **Cluster Analysis** | An AI-generated synthesis of related articles within a Cluster | Topic analysis, cluster summary |
| **Custom Prompt** | User-provided text that modifies or overrides the default AI prompt for a specific operation | Custom instructions, override prompt |
| **Processing Pipeline** | The ordered sequence of stages an Article passes through: Scrape → Process → Rate → Categorize → Cluster → Analyze → Synthesize (new) | Workflow, pipeline |

## Briefing Generation

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Briefing** | A synthesized intelligence report generated from Cluster Analyses for a given Feed Profile | Brief, report, digest |
| **Brief Synthesis** | The process of combining Cluster Analyses into a final Briefing | Synthesis, generation |
| **Standard Briefing** | A Briefing generated through the full Processing Pipeline including clustering, Cluster Analysis, and Brief Synthesis (new) | Full briefing, complete briefing |
| **Simple Briefing** | A Briefing generated via a shortened pipeline without per-cluster analysis (new) | Quick brief, lite briefing |
| **Custom Briefing** | A Briefing where the user has provided Custom Prompts for Cluster Analysis and/or Brief Synthesis (new) | User briefing, personalized briefing |

## YouTube Content

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Transcription** | Text extracted from a YouTube video with an AI-generated Summary | YouTube transcription, video transcript |
| **Audio File** | Text-to-speech generated audio from an article Summary or Transcription Summary | TTS audio, audio |

## Async Processing

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Job** | A unit of asynchronous work submitted to a Queue, with typed input and retry semantics (new) | Task, worker, background job |
| **Queue** | A named Redis-backed BullMQ channel that holds and delivers Jobs to Processors (new) | Worker queue, task queue |
| **Processor** | The consumer service that dequeues and executes Jobs from a specific Queue (new) | Worker, handler, consumer |
| **Audio Job** | A Job that generates an Audio File from article or transcription text via TTS (new) | TTS job, audio task |

## User Interaction

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **User** | An authenticated identity in the system | Account, login |
| **Bookmark** | A saved article reference associated with a User | Saved article, star, favorite |

## Relationships

- An **Article** belongs to exactly one **Feed Profile**
- An **Article** has one **Summary** (after Processing)
- An **Article** has one **Embedding** (after Processing)
- An **Article** has one **Impact Rating** (after rating)
- An **Article** has one or more **Categories** (after categorization)
- A **Cluster** contains one or more **Articles** with similar **Embeddings**
- A **Cluster Analysis** synthesizes the **Articles** within a single **Cluster**
- A **Briefing** is generated from one or more **Cluster Analyses** for a single **Feed Profile**
- A **Standard Briefing** requires at least one **Cluster Analysis**; a **Simple Briefing** does not
- A **Custom Briefing** is any Briefing where at least one **Custom Prompt** was applied
- A **Transcription** belongs to exactly one **YouTube Channel**
- A **Transcription** may have an associated **Audio File**
- An **Article** may have an associated **Audio File**
- A **Bookmark** belongs to exactly one **User** and exactly one **Article**
- A **Job** belongs to exactly one **Queue** and is consumed by exactly one **Processor**

## Example dialogue

> **Dev:** "When an **Article** is scraped, does it immediately get **Processing**?"
> **Domain expert:** "No — the **Scraper** fetches raw content and enqueues a **Job**. The **Processor** picks it up asynchronously, generates the **Summary** and **Embedding**, then the **Article** can be Impact Rated and Categorized."
> **Dev:** "So an **Article** must complete the **Processing Pipeline** before it can go into a **Briefing**?"
> **Domain expert:** "Correct. A **Standard Briefing** needs **Articles** with **Embeddings** to form **Clusters**. Each **Cluster** gets a **Cluster Analysis**, which are then combined by **Brief Synthesis** into the final **Briefing**. A **Simple Briefing** skips the per-cluster step."
> **Dev:** "What about a **Custom Briefing**?"
> **Domain expert:** "Same pipeline, but the user supplies **Custom Prompts** that replace the default prompts for **Cluster Analysis** and/or **Brief Synthesis**. The `isCustom` flag on the **Briefing** entity reflects this."
> **Dev:** "And if someone submits an **External Article**?"
> **Domain expert:** "It goes through the same pipeline — scrape, process, rate, categorize — but arrives via the public endpoint with a token, and is rate-limited. Internally submitted articles arrive authenticated with no rate limit."

## Flagged ambiguities

- **"processed_content" vs "summary"** — In the DB schema, `processed_content` stores the summary. In code comments and variables, both terms appear. Use **Summary** when discussing the AI-generated output; use `processed_content` only when referring to the database column directly.
- **"briefing" vs "brief"** — Both terms appear interchangeably. The DB table is `briefings`; generation uses `BriefingGenerationService`; methods use "brief" (e.g., `saveBrief`, `generateBrief`). Prefer **Briefing** as the domain noun; "brief" is acceptable in compound method names only.
- **"transcription" vs "youtube transcription"** — The entity is `YoutubeTranscription` but informally called "transcription". Since no other transcription type exists, **Transcription** is acceptable; always capitalize to signal the domain entity.
- **"feed_profile" vs "profile"** — `FeedProfile` is the enum; shorthand "profile" is common in code. **Feed Profile** is the canonical domain term; "profile" alone is acceptable only when context is unambiguous.
- **"isCustom" flag** — `BriefingEntity.isCustom` marks whether **Custom Prompts** were used, making it a **Custom Briefing**. Do not confuse with the user submitting a **Custom Briefing** type directly; the flag is derived from whether any prompt was overridden.
- **"Job" overloading** — "Job" is used generically in tech contexts. In this codebase, **Job** always refers specifically to a BullMQ queue job. Generic task language ("run a job") should be replaced with the specific **Job** type (e.g., **Audio Job**, article processing Job).
- **Briefings module split** — `src/briefings/` holds both `BriefingsService` (persistence) and `BriefingGenerationService` (orchestration). Both operate on the same **Briefing** entity; the module boundary is implementation detail, not domain boundary.

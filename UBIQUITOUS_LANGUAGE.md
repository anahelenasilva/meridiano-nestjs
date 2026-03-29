# Ubiquitous Language

## Content Sources

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Article** | A news or blog item scraped from RSS feeds or manually submitted | Post, story, item |
| **RSS Feed** | A syndicated content source configured for automated article discovery | Feed, source |
| **Feed Profile** | A thematic categorization of content sources (technology, politics, business, etc.) | Profile, feed type |
| **YouTube Channel** | A configured video channel for transcription extraction | Channel, video source |
| **Scraper** | The component that fetches articles from RSS feeds | Crawler, fetcher |

## Content Processing

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Processing** | The act of summarizing an article's raw content with AI | Analyzing, digesting |
| **Embedding** | A vector representation of an article summary for semantic clustering | Vector, encoding |
| **Impact Rating** | A 1-10 score assigned by AI to rate article significance | Rating, score, importance |
| **Category** | An article classification (news, blog, research, tutorial, etc.) | Classification, tag, type |
| **Cluster** | A group of semantically related articles based on embedding similarity | Group, topic cluster |
| **Cluster Analysis** | An AI-generated synthesis of related articles within a cluster | Topic analysis, cluster summary |
| **Custom Prompt** | User-provided text that modifies or overrides default AI prompts | Custom instructions, override prompt |

## Briefing Generation

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Briefing** | A synthesized intelligence report generated from analyzed articles and cluster analyses | Brief, report, digest |
| **Brief Synthesis** | The process of combining cluster analyses into a final briefing | Synthesis, generation |

## YouTube Content

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **Transcription** | Text extracted from a YouTube video with an AI-generated summary | YouTube transcription, video transcript |
| **Audio File** | Text-to-speech generated audio from article summaries or transcriptions | TTS audio, audio |

## User Interaction

| Term | Definition | Aliases to avoid |
|------|-----------|-----------------|
| **User** | An authenticated identity in the system | Account, login |
| **Bookmark** | A saved article reference associated with a user | Saved article, star, favorite |

## Relationships

- An **Article** belongs to exactly one **Feed Profile**
- An **Article** has one **Embedding** (after processing)
- An **Article** has one **Impact Rating** (after rating)
- An **Article** has one or more **Categories** (after categorization)
- A **Cluster** contains one or more **Articles** with similar **Embeddings**
- A **Cluster Analysis** synthesizes **Articles** within a single **Cluster**
- A **Briefing** is generated from multiple **Cluster Analyses**
- A **Transcription** belongs to exactly one **YouTube Channel**
- A **Bookmark** belongs to exactly one **User** and exactly one **Article**

## Example dialogue

> **Dev:** "When an **Article** is scraped, does it immediately get **Processing**?"
> **Domain expert:** "No — the **Scraper** fetches raw content first. **Processing** happens separately and generates a summary and **Embedding**. Only after **Processing** can an **Article** be **Impact Rated** and **Categorized**."
> **Dev:** "So an **Article** must be processed before it can be included in a **Briefing**?"
> **Domain expert:** "Correct. A **Briefing** requires **Articles** with **Embeddings** so they can form **Clusters**. Each **Cluster** produces a **Cluster Analysis**, and those analyses are synthesized into the final **Briefing**."
> **Dev:** "What if a user provides a **Custom Prompt**?"
> **Domain expert:** "The **Custom Prompt** is applied during **Processing** for **Articles**, or during **Cluster Analysis** and **Brief Synthesis** for **Briefings**. It modifies the default AI prompts for that specific item."

## Flagged ambiguities

- **"processed_content" vs "summary"** — In the database schema, `processed_content` stores the summary. In code comments and variable names, both terms are used. Prefer **summary** when discussing the AI-generated output, and **processed_content** when referring to the database field.
- **"briefing" vs "brief"** — Both terms appear interchangeably. The database table is `briefings`; generation uses `BriefingGenerationService`, persistence uses `BriefingsService`; method names use "brief" (e.g., `saveBrief`, `generateBrief`). Prefer **Briefing** as the noun for the domain object; "brief" is acceptable in compound method names.
- **"transcription" vs "youtube transcription"** — The entity is `YoutubeTranscription` but often referred to as just "transcription". Since no other transcription types exist, "transcription" is acceptable, but **Transcription** (capitalized) should refer to the domain entity.
- **"feed_profile" vs "profile"** — `FeedProfile` is the enum, but shorthand "profile" is common. Acceptable when context is clear, but **Feed Profile** is the canonical term for the domain concept.
- **Briefings module** — `src/briefings/` holds both persistence (`BriefingsService`) and generation (`BriefingGenerationService`) for the same **Briefing** concept.
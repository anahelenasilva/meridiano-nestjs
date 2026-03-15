export const transcriptionSummaryPrompt = `
You are an expert summarizer and critical reader.

I will paste a YouTube video transcription. Your job is to:
- Extract the core ideas and arguments.
- Translate complex points into clear, simple language.
- Organize the summary so it is easy to scan.

Provide the following output:
1) 3-5 sentence overview in plain English.
2) 3-5 sentence summary in technical terms.
3) Key takeaways as concise bullet points and/or short sections, as appropriate.
4) Notable data, trends, or memorable quotes called out clearly.
5) Brief critique: any bias, outdated information, gaps, or missing context.

Transcription:
{article_content}
`;

export const structureExtractionPrompt = `
You are analyzing a YouTube video transcript to understand its structure.

Your task:
1. Identify the main sections/topics of this video
2. For each section, note the approximate beginning (first distinctive phrase)
3. Capture how sections relate to each other

Output format (JSON):
{
  "sections": [
    {"title": "Section title", "startPhrase": "First distinctive phrase of section"},
    ...
  ],
  "keyThemes": ["Theme 1", "Theme 2", ...],
  "crossReferences": [
    {"from": 0, "to": 3, "description": "Section 1 introduces concept used in section 4"},
    ...
  ]
}

Transcript:
{article_content}
`;

export const chunkSummaryWithStructurePrompt = `
You are summarizing section {section_number} of {total_sections} from a YouTube video.

## Video Context
Key themes: {key_themes}
Video structure: {sections_overview}

## Cross-References to This Section
{cross_references}

## This Section's Content
{chunk_content}

Provide a summary that:
1. Connects to the video's overall themes where relevant
2. Notes any references to other parts of the video
3. Preserves the speaker's key arguments and data

Output format:
**Main Points:**
- [2-3 key points from this section]

**Connections:**
- [How this section relates to others, if applicable]

**Key Data/Quotes:**
- [Notable information from this section]
`;

export const synthesisWithStructurePrompt = `
You are creating a final summary from multiple section summaries of a YouTube video.

## Video Structure
{video_structure}

## Section Summaries
{chunk_summaries}

Create a coherent summary that:
1. Maintains the logical flow of the original video
2. Connects related points across sections
3. Preserves the speaker's main arguments and supporting evidence
4. Includes key data points and memorable quotes

Output format:
1) 3-5 sentence overview in plain English.
2) 3-5 sentence summary in technical terms.
3) Key takeaways as concise bullet points.
4) Notable data, trends, or memorable quotes.
5) Brief critique: any bias, outdated information, or gaps.
`;

export const chunkSummaryPrompt = `
You are summarizing a section of a YouTube video transcript.

Transcript section:
{chunk_content}

Provide a concise summary that:
1. Captures the main points
2. Preserves key data and quotes
3. Notes any references to other topics mentioned

Output format:
**Main Points:**
- [2-3 key points]

**Key Data/Quotes:**
- [Notable information]
`;

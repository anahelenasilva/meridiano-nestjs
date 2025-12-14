export const transcriptionClassificationPrompt = `Analyze the following youtube video transcription title and content to classify it into appropriate categories.

Available categories:
- ai: AI related content
- news: General news youtube video
- blog: Blog posts or opinion pieces
- research: Research youtube video or technical studies
- nodejs: Node.js related content
- typescript: TypeScript related content
- tutorial: Tutorials or how-to guides
- other: Content that doesn't fit other categories

Transcription Title: "{title}"
Transcription Content: "{content}"

Analyze the content and return ONLY a JSON array of relevant categories. For example:
["news", "nodejs"] or ["tutorial", "typescript"] or ["research"]

Choose 1-3 most relevant categories. Return only the JSON array, no other text.`;

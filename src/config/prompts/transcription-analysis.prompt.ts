export const transcriptionAnalysisPrompt = `These are summaries of potentially related youtube video transcription from a '{feed_profile}' context:

{cluster_summaries_text}

What is the core event or topic discussed? Summarize the key developments and significance in 3-5 sentences based *only* on the provided text. If the youtube video transcription seem unrelated, state that clearly.
`;

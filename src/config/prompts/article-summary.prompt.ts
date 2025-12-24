// export const articleSummaryPrompt = `
// Summarize the key points of this news article objectively in 2-4 sentences.
// Identify the main topics covered.

// Article:
// {article_content}
// `;

export const articleSummaryPrompt = `
You are an expert summarizer and critical reader.

I will paste an article (news or technical article). Your job is to:
- Extract the core ideas and arguments from the article.
- Translate complex points into clear, simple language.
- Organize the summary so it is easy to scan.

Output on the {article_content} property:
1) 3-5 sentence overview in plain English.
2) 3-5 sentence summary in technical terms.
3) Key takeaways as concise bullet points and/or short sections, as appropriate.
4) Notable data, trends, or memorable quotes called out clearly.
5) Brief critique: any bias, outdated information, gaps, or missing context.

Transcription:
{article_content}
`;

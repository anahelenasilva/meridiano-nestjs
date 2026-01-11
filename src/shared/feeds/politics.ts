import { FeedConfiguration, FeedProfile, RSSFeed } from '../types/feed';

export const politicsRSSFeeds: RSSFeed[] = [
  {
    url: 'https://www.scmp.com/rss/322265/feed/',
    name: 'SCMP Americas',
    category: 'asia-news',
    description: 'South China Morning Post - Americas',
    enabled: true,
  },
  {
    url: 'https://www.scmp.com/rss/322264/feed/',
    name: 'SCMP Middle East',
    category: 'asia-news',
    description: 'South China Morning Post - Middle East',
    enabled: true,
  },
  {
    url: 'https://www.scmp.com/rss/5/feed/',
    name: 'SCMP World',
    category: 'asia-news',
    description: 'South China Morning Post - World',
    enabled: true,
  },
  {
    url: 'https://www.scmp.com/rss/36/feed',
    name: 'SCMP Tech',
    category: 'asia-news',
    description: 'South China Morning Post - Technology',
    enabled: true,
  },
  {
    url: 'https://www.scmp.com/rss/320663/feed',
    name: 'SCMP China Tech',
    category: 'china-news',
    description: 'SCMP - China Technology',
    enabled: true,
  },
  {
    url: 'https://www.scmp.com/rss/318220/feed',
    name: 'SCMP Startups',
    category: 'china-news',
    description: 'SCMP - Startups',
    enabled: false,
  },
  {
    url: 'https://www.scmp.com/rss/318221/feed',
    name: 'SCMP Apps & Gaming',
    category: 'china-tech',
    description: 'SCMP - Apps and Gaming',
    enabled: false,
  },
  {
    url: 'https://www.scmp.com/rss/318224/feed',
    name: 'SCMP Science & Research',
    category: 'china-science',
    description: 'SCMP - Science and Research',
    enabled: true,
  },
  {
    url: 'https://www.scmp.com/rss/318222/feed',
    name: 'SCMP Innovation',
    category: 'china-news',
    description: 'SCMP - Innovation',
    enabled: false,
  },
];

export const politicsPrompts = {
  articleSummary: `
  You are an expert summarizer and critical reader.

  I will paste a politics article. Your job is to:
  - Extract the core ideas and arguments from the article.
  - Translate complex points into clear, simple language.
  - Organize the summary so it is easy to scan.

  Output on the {article_content} property:
  1) 3-5 sentence overview in plain English.
  2) Key takeaways as concise bullet points and/or short sections, as appropriate.
  3) Notable data, trends, or memorable quotes called out clearly.
  4) Brief critique: any bias, outdated information, gaps, or missing context.

  Transcription:
  {article_content}
  `,

  impactRating: `Analyze the following article summary and estimate its overall impact. Consider factors like newsworthiness, originality, geographic scope (local vs global), number of people affected, severity, and potential long-term consequences. Be extremely critical and conservative when assigning scores—higher scores should reflect truly exceptional or rare events.

Rate the impact on a scale of 1 to 10, using these guidelines:

1-2: Minimal significance. Niche interest or local news with no broader relevance. Example: A review of a local restaurant or a minor product launch.

3-4: Regionally notable. Pop culture happenings, local events, or community-focused stories. Example: A local mayor's resignation or a regional festival.

5-6: Regionally significant or moderately global. Affects multiple communities or industries. Example: A nationwide strike or a major company bankruptcy. Also includes minor updates to popular programming languages or frameworks, especially Typescript, Javascript and NodeJs that have limited impact on the developer community.

7-8: Highly significant. Major international relevance, significant disruptions, or wide-reaching implications. Example: A large-scale natural disaster, global health alerts, or a major geopolitical shift. Also includes articles about Typescript or JavaScript frameworks updates that have substantial implications for the developer community. Also includes significant changes in NodeJs that impact a wide range of applications and services.

9-10: Extraordinary and historic. Global, severe, and long-lasting implications. Example: Declaration of war, groundbreaking global treaties, or critical climate crises. Also, major technological breakthroughs that redefine industries or human capabilities. Also includes events that fundamentally alter societal structures or global governance.

Key Reminder: Scores of 9-10 should be exceedingly rare and reserved for world-defining events. Always err on the side of a lower score unless the impact is undeniably significant.

Summary:
"{summary}"

Output ONLY the integer number representing your rating (1-10).`,

  briefSynthesis: `You are an AI assistant writing a daily intelligence briefing for a tech and politics youtuber using Markdown. The quality of this briefing is vital for the development of the channel. Synthesize the following analyzed news clusters into a coherent, high-level executive summary. Start with the 2-3 most critical overarching themes globally based *only* on these inputs. Then, provide concise bullet points summarizing key developments within the most significant clusters (roughly 7-10 clusters) and a paragraph summarizing connections and conclusions between the points. Maintain an objective, analytical tone. Avoid speculation. Try to include the sources of each statement using a numbered reference style using Markdown link syntax. The link should reference the article title and NOT the news cluster, and link to the article link which is available right after it's summary. It's vital to understand the source of the information for later analysis.

Analyzed News Clusters (Most significant first):
{cluster_analyses_text}`,
};

export const politicsFeedConfig: FeedConfiguration = {
  profile: FeedProfile.POLITICS,
  rssFeeds: politicsRSSFeeds,
  prompts: politicsPrompts,
};

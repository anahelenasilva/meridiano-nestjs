import { FeedConfiguration, FeedProfile, RSSFeed } from '../types/feed';

export const techRSSFeeds: RSSFeed[] = [
  {
    url: 'https://nodejs.org/en/feed/blog.xml',
    name: 'NodeJs Blog',
    category: 'technical',
    description: 'Official Node.js project blog',
    enabled: true,
  },
  {
    url: 'https://techcrunch.com/feed/',
    name: 'TechCrunch',
    category: 'startup',
    description: 'Technology startup news and venture capital',
    enabled: true,
  },
  {
    url: 'https://www.tabnews.com.br/recentes/rss',
    name: 'TabNews',
    category: 'technical',
    description:
      "Technology articles and news; it's also a Brazilian platform and community",
    enabled: true,
  },
  {
    url: 'https://leaddev.com/feed',
    name: 'LeadDev',
    category: 'technical',
    description:
      'Hosts thousands of free articles and videos that can help you improve your performance and that of your entire engineering org.',
    enabled: true,
  },
  {
    url: 'https://www.theverge.com/rss/index.xml',
    name: 'The Verge',
    category: 'consumer-tech',
    description: 'Consumer technology and culture',
    enabled: false,
  },
  {
    url: 'https://arstechnica.com/feed/',
    name: 'Ars Technica',
    category: 'technical',
    description: 'In-depth technology analysis and science',
    enabled: false,
  },
  {
    url: 'https://krebsonsecurity.com/feed/',
    name: 'Krebs on Security',
    category: 'cybersecurity',
    description: 'Cybersecurity news and investigative reporting',
    enabled: false,
  },
  {
    url: 'https://feeds.feedburner.com/TheHackersNews',
    name: 'The Hacker News',
    category: 'cybersecurity',
    description: 'Cybersecurity and hacking news',
    enabled: true,
  },
  {
    url: 'https://raw.githubusercontent.com/theworkitem/feeds/master/xml/theworkitem-itunes.xml',
    name: 'The Work Item Podcast',
    category: 'tech-culture',
    description: "Podcast on Real Talk on Tech's Toughest Career Choices",
    enabled: true,
  },
  {
    url: 'https://feed.infoq.com/',
    name: "InfoQ",
    category: 'tech',
    description:
      'InfoQ is a technology news website that covers the latest news and trends in the technology industry.',
    enabled: false,
  },
  {
    url: 'https://simonwillison.net/atom/everything/',
    name: "Simon Willison's Weblog",
    category: 'tech',
    description:
      'Simon Willison is a co-creator of the Django Web Framework, and has been blogging about web development and programming since 2002 at simonwillison.net',
    enabled: true,
  },
  {
    url: 'https://www.404media.co/rss/',
    name: "404 Media",
    category: 'tech',
    description:
      '404 Media is a journalist-founded digital media company exploring the ways technology is shaping-and is shaped by-our world.',
    enabled: true,
  },
];

export const techPrompts = {
  articleSummary: `
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

export const techFeedConfig: FeedConfiguration = {
  profile: FeedProfile.TECHNOLOGY,
  rssFeeds: techRSSFeeds,
  prompts: techPrompts,
  settings: {
    priority: 1,
    enabled: true,
  },
};

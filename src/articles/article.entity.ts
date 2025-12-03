import { ImpactRating } from '../shared/types/ai';
import { FeedProfile } from '../shared/types/feed';

export interface PaginatedArticleInput {
  page?: number;
  perPage?: number;
  sortBy?: string;
  direction?: 'asc' | 'desc';
  feedProfile?: string;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
}

export interface CountTotalArticlesInput {
  feedProfile?: string;
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
}

export interface ArticleSummary {
  id: string;
  title: string;
  content: string;
  summary: string;
  impactRating: ImpactRating;
  timestamp: Date;
  feedProfile: FeedProfile;
}

export interface NewsCluster {
  id: string;
  articles: ArticleSummary[];
  analysis: string;
  significance: number;
  topics: string[];
}

export interface DBArticle {
  id: number;
  url: string;
  title: string;
  published_date: Date;
  feed_source: string;
  raw_content: string;
  processed_content?: string | null;
  embedding?: string | null; // JSON string
  impact_rating?: number | null;
  feed_profile: string;
  image_url?: string | null;
  created_at: Date;
  categories?: ArticleCategory[] | null;
}

export interface ArticleContent {
  content: string | null;
  ogImage: string | null;
}

export interface ClusterAnalysis {
  topic: string;
  analysis: string;
  size: number;
  articles?: DBArticle[];
}

export enum ArticleCategory {
  NEWS = 'news',
  BLOG = 'blog',
  RESEARCH = 'research',
  NODEJS = 'nodejs',
  TYPESCRIPT = 'typescript',
  TUTORIAL = 'tutorial',
  OTHER = 'other',
}

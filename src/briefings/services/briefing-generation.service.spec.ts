import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { AiService } from '../../ai/ai.service';
import { DBArticle } from '../../articles/article.entity';
import { ArticlesService } from '../../articles/articles.service';
import { ConfigService } from '../../config/config.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { FeedProfile } from '../../shared/types/feed';
import { BriefingsService } from '../briefings.service';
import { BriefingGenerationService } from './briefing-generation.service';

function createArticle(overrides: Partial<DBArticle> = {}): DBArticle {
  const base: DBArticle = {
    id: 'article-1',
    url: 'https://example.com/a',
    title: 'Test Article',
    published_date: new Date('2025-01-01'),
    feed_source: 'feed',
    raw_content: '',
    processed_content: 'Processed body for briefing.',
    impact_rating: 8,
    feed_profile: FeedProfile.DEFAULT,
    created_at: new Date('2025-01-01'),
  };
  return { ...base, ...overrides };
}

describe('BriefingGenerationService', () => {
  let service: BriefingGenerationService;
  const mockArticlesService = mock<ArticlesService>();
  const mockBriefingsService = mock<BriefingsService>();
  const mockAiService = mock<AiService>();
  const mockConfigService = mock<ConfigService>();
  const mockProfilesService = mock<ProfilesService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BriefingGenerationService,
        { provide: ArticlesService, useValue: mockArticlesService },
        { provide: BriefingsService, useValue: mockBriefingsService },
        { provide: AiService, useValue: mockAiService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: ProfilesService, useValue: mockProfilesService },
      ],
    }).compile();

    service = module.get<BriefingGenerationService>(BriefingGenerationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateSimpleBrief returns error when all articles have null processed_content', async () => {
    mockConfigService.getProcessingConfig.mockReturnValue({
      briefingArticleLookbackHours: 24,
      minArticlesForBriefing: 5,
      articlesPerPage: 15,
      clustersQtd: 10,
      clusterAnalysisDelayMs: 0,
    });
    mockArticlesService.getArticlesForBriefing.mockResolvedValue([
      createArticle({ id: 'a1', processed_content: null }),
      createArticle({ id: 'a2', processed_content: undefined }),
    ]);

    const result = await service.generateSimpleBrief(FeedProfile.DEFAULT);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No articles with processed content found');
    expect(mockAiService.callChat).not.toHaveBeenCalled();
  });

  it('generateSimpleBrief returns error when no articles', async () => {
    mockConfigService.getProcessingConfig.mockReturnValue({
      briefingArticleLookbackHours: 24,
      minArticlesForBriefing: 5,
      articlesPerPage: 15,
      clustersQtd: 10,
      clusterAnalysisDelayMs: 0,
    });
    mockArticlesService.getArticlesForBriefing.mockResolvedValue([]);

    const result = await service.generateSimpleBrief(FeedProfile.DEFAULT);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No articles found for briefing');
  });

  it('generateSimpleBrief uses callChat only (DeepSeek vs OpenAI is chosen inside AiService)', async () => {
    mockConfigService.getProcessingConfig.mockReturnValue({
      briefingArticleLookbackHours: 24,
      minArticlesForBriefing: 5,
      articlesPerPage: 15,
      clustersQtd: 10,
      clusterAnalysisDelayMs: 0,
    });

    const article = createArticle({
      id: 'a1',
      title: 'Headline Alpha',
      processed_content: 'Summary text for the article.',
    });
    mockArticlesService.getArticlesForBriefing.mockResolvedValue([article]);
    mockProfilesService.getPromptsForProfile.mockReturnValue({});
    mockConfigService.getSimpleBriefPrompt.mockReturnValue(
      "Create a concise briefing for the 'default' profile based on these recent articles:\n\n1. **Headline Alpha**",
    );
    mockAiService.callChat.mockResolvedValue('# Brief\n\nExecutive summary.');
    mockBriefingsService.saveBrief.mockResolvedValue('briefing-uuid');

    const result = await service.generateSimpleBrief(FeedProfile.DEFAULT);

    expect(result.success).toBe(true);
    expect(mockAiService.callChat).toHaveBeenCalledTimes(1);
    const [prompt] = mockAiService.callChat.mock.calls[0];
    expect(prompt).toContain('Headline Alpha');
    expect(prompt).toContain('Create a concise briefing');
    expect(mockAiService.callDeepseekChat).not.toHaveBeenCalled();
    expect(mockAiService.callOpenAIChat).not.toHaveBeenCalled();
  });

  it('analyzeCluster filters articles with null processed_content before building prompt', async () => {
    const embedding = (x: number, y: number) =>
      JSON.stringify([x, y, x + 0.1, y + 0.1]);

    const validArticle = (id: string, x: number, y: number) =>
      createArticle({
        id,
        processed_content: `content-${id}`,
        embedding: embedding(x, y),
      });

    const articles = [
      validArticle('a1', 0.1, 0.2),
      validArticle('a2', 0.3, 0.4),
      createArticle({ id: 'a3', processed_content: null, embedding: embedding(0.5, 0.6) }),
      createArticle({ id: 'a4', processed_content: undefined, embedding: embedding(0.7, 0.8) }),
    ];

    mockConfigService.getBriefingConfig.mockReturnValue({
      feedProfile: FeedProfile.DEFAULT,
      lookbackHours: 24,
      minArticles: 2,
      clustersQtd: 2,
      articlesPerPage: 15,
      customPrompts: undefined,
    });
    mockArticlesService.getArticlesForBriefing.mockResolvedValue(articles);
    mockProfilesService.getPromptsForProfile.mockReturnValue({
      clusterAnalysis: null,
      briefSynthesis: null,
    });
    mockConfigService.getPrompt.mockReturnValue('{cluster_summaries_text}');
    mockConfigService.formatPrompt.mockImplementation((template, vars) =>
      template.replace(
        '{cluster_summaries_text}',
        (vars as Record<string, string>).cluster_summaries_text ?? '',
      ).replace(
        '{cluster_analyses_text}',
        (vars as Record<string, string>).cluster_analyses_text ?? '',
      ).replace('{feed_profile}', ''),
    );
    mockAiService.callChat.mockResolvedValue('cluster-analysis-text');
    mockBriefingsService.saveBrief.mockResolvedValue('brief-uuid');

    await service.generateBrief(FeedProfile.DEFAULT);

    const clusterAnalysisCalls = mockAiService.callChat.mock.calls.filter(
      ([prompt]) => !prompt.includes('cluster-analysis-text'),
    );
    for (const [prompt] of clusterAnalysisCalls) {
      expect(prompt).not.toContain('- null');
      expect(prompt).not.toContain('- undefined');
    }
  });

  it('analyzeCluster returns null without calling AI when all articles have null processed_content', async () => {
    const embedding = (x: number, y: number) =>
      JSON.stringify([x, y, x + 0.1, y + 0.1]);

    const articles = [
      createArticle({ id: 'a1', processed_content: null, embedding: embedding(0.1, 0.2) }),
      createArticle({ id: 'a2', processed_content: null, embedding: embedding(0.3, 0.4) }),
      createArticle({ id: 'a3', processed_content: undefined, embedding: embedding(0.5, 0.6) }),
      createArticle({ id: 'a4', processed_content: undefined, embedding: embedding(0.7, 0.8) }),
    ];

    mockConfigService.getBriefingConfig.mockReturnValue({
      feedProfile: FeedProfile.DEFAULT,
      lookbackHours: 24,
      minArticles: 2,
      clustersQtd: 2,
      articlesPerPage: 15,
      customPrompts: undefined,
    });
    mockArticlesService.getArticlesForBriefing.mockResolvedValue(articles);

    const result = await service.generateBrief(FeedProfile.DEFAULT);

    expect(result.success).toBe(false);
    expect(mockAiService.callChat).not.toHaveBeenCalled();
  });

  it('generateSimpleBrief returns error when callChat returns null', async () => {
    mockConfigService.getProcessingConfig.mockReturnValue({
      briefingArticleLookbackHours: 24,
      minArticlesForBriefing: 5,
      articlesPerPage: 15,
      clustersQtd: 10,
      clusterAnalysisDelayMs: 0,
    });
    mockArticlesService.getArticlesForBriefing.mockResolvedValue([
      createArticle(),
    ]);
    mockAiService.callChat.mockResolvedValue(null);

    const result = await service.generateSimpleBrief(FeedProfile.DEFAULT);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to generate brief content');
    expect(mockAiService.callChat).toHaveBeenCalledTimes(1);
    expect(mockAiService.callDeepseekChat).not.toHaveBeenCalled();
    expect(mockAiService.callOpenAIChat).not.toHaveBeenCalled();
  });

  it('generateCustomBrief saves the brief when title generation fails', async () => {
    mockArticlesService.getArticlesByIds.mockResolvedValue([
      createArticle({ id: 'article-1', title: 'First' }),
      createArticle({ id: 'article-2', title: 'Second' }),
    ]);
    mockProfilesService.getPromptsForProfile.mockReturnValue({
      simpleBriefing: 'Default custom brief prompt',
    });
    mockConfigService.getSimpleBriefPrompt.mockReturnValue('brief prompt');
    mockAiService.callChat
      .mockResolvedValueOnce('# Custom Brief')
      .mockRejectedValueOnce(new Error('title model unavailable'));
    mockBriefingsService.saveBrief.mockResolvedValue('brief-uuid');

    const result = await service.generateCustomBrief(
      ['article-1', 'article-2'],
      FeedProfile.DEFAULT,
    );

    expect(result.success).toBe(true);
    expect(mockBriefingsService.saveBrief).toHaveBeenCalledWith(
      '# Custom Brief',
      ['article-1', 'article-2'],
      FeedProfile.DEFAULT,
      { isCustom: true, customTitle: undefined },
    );
  });
});

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

  it('generateSimpleBrief returns error when no articles', async () => {
    mockConfigService.getProcessingConfig.mockReturnValue({
      briefingArticleLookbackHours: 24,
      minArticlesForBriefing: 5,
      articlesPerPage: 15,
      clustersQtd: 10,
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
    });

    const article = createArticle({
      id: 'a1',
      title: 'Headline Alpha',
      processed_content: 'Summary text for the article.',
    });
    mockArticlesService.getArticlesForBriefing.mockResolvedValue([article]);
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

  it('generateSimpleBrief returns error when callChat returns null', async () => {
    mockConfigService.getProcessingConfig.mockReturnValue({
      briefingArticleLookbackHours: 24,
      minArticlesForBriefing: 5,
      articlesPerPage: 15,
      clustersQtd: 10,
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
});

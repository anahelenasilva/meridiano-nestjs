import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { AiService } from '../../ai/ai.service';
import { ArticlesService } from '../../articles/articles.service';
import { ConfigService } from '../../config/config.service';
import { ProfilesService } from '../../profiles/profiles.service';
import { FeedProfile } from '../../shared/types/feed';
import { BriefingsService } from '../briefings.service';
import { BriefingGenerationService } from './briefing-generation.service';

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
});

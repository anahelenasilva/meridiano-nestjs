import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { FeedProfile } from '../../shared/types/feed';
import { BriefingGenerationService } from '../services/briefing-generation.service';
import { GenerateBriefInputDto } from './dto/generate-brief.dto';
import { GenerateBriefUseCase } from './generate-brief.usecase';

describe('GenerateBriefUseCase', () => {
  let useCase: GenerateBriefUseCase;
  const mockBriefingGenerationService = mock<BriefingGenerationService>();
  const mockConfigService = mock<ConfigService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateBriefUseCase,
        { provide: BriefingGenerationService, useValue: mockBriefingGenerationService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    useCase = module.get<GenerateBriefUseCase>(GenerateBriefUseCase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const input: GenerateBriefInputDto = { feedProfile: FeedProfile.DEFAULT };

  it('returns disabled error when feature flag off', async () => {
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(false);

    const result = await useCase.execute(input);

    expect(result.success).toBe(false);
    expect(result.error).toContain('disabled');
    expect(mockBriefingGenerationService.generateBrief).not.toHaveBeenCalled();
  });

  it('returns success with briefingId and stats on success path', async () => {
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(true);
    mockBriefingGenerationService.generateBrief.mockResolvedValue({
      success: true,
      briefingId: 'brief-123',
      stats: { articlesAnalyzed: 10, clustersGenerated: 3, clustersUsed: 2 },
    });

    const result = await useCase.execute(input);

    expect(result.success).toBe(true);
    expect(result.briefingId).toBe('brief-123');
    expect(result.stats?.articlesAnalyzed).toBe(10);
    expect(result.stats?.clustersUsed).toBe(2);
  });

  it('propagates error from service', async () => {
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(true);
    mockBriefingGenerationService.generateBrief.mockResolvedValue({
      success: false,
      error: 'Not enough articles',
    });

    const result = await useCase.execute(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Not enough articles');
  });

  it('forwards customPrompts to generateBrief', async () => {
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(true);
    mockBriefingGenerationService.generateBrief.mockResolvedValue({
      success: true,
      briefingId: 'brief-456',
    });
    const inputWithPrompts: GenerateBriefInputDto = {
      feedProfile: FeedProfile.DEFAULT,
      customPrompts: { briefSynthesis: 'Custom synthesis prompt' },
    };

    await useCase.execute(inputWithPrompts);

    expect(mockBriefingGenerationService.generateBrief).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
      { customPrompts: { briefSynthesis: 'Custom synthesis prompt' } },
    );
  });

  it('passes undefined customPrompts when not provided', async () => {
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(true);
    mockBriefingGenerationService.generateBrief.mockResolvedValue({ success: true });

    await useCase.execute(input);

    expect(mockBriefingGenerationService.generateBrief).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
      { customPrompts: undefined },
    );
  });
});

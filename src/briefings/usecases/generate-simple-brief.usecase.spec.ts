import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ConfigService } from '../../config/config.service';
import { FeedProfile } from '../../shared/types/feed';
import { BriefingGenerationService } from '../services/briefing-generation.service';
import { GenerateBriefInputDto } from './dto/generate-brief.dto';
import { GenerateSimpleBriefUseCase } from './generate-simple-brief.usecase';

describe('GenerateSimpleBriefUseCase', () => {
  let useCase: GenerateSimpleBriefUseCase;
  const mockBriefingGenerationService = mock<BriefingGenerationService>();
  const mockConfigService = mock<ConfigService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GenerateSimpleBriefUseCase,
        { provide: BriefingGenerationService, useValue: mockBriefingGenerationService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    useCase = module.get<GenerateSimpleBriefUseCase>(GenerateSimpleBriefUseCase);
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
    expect(mockBriefingGenerationService.generateSimpleBrief).not.toHaveBeenCalled();
  });

  it('returns success with briefingId on success path', async () => {
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(true);
    mockBriefingGenerationService.generateSimpleBrief.mockResolvedValue({
      success: true,
      briefingId: 'simple-brief-uuid',
    });

    const result = await useCase.execute(input);

    expect(result.success).toBe(true);
    expect(result.briefingId).toBe('simple-brief-uuid');
    expect(mockBriefingGenerationService.generateSimpleBrief).toHaveBeenCalledWith(
      FeedProfile.DEFAULT,
    );
  });

  it('propagates error from service', async () => {
    mockConfigService.isBriefingsGenerationEnabled.mockReturnValue(true);
    mockBriefingGenerationService.generateSimpleBrief.mockResolvedValue({
      success: false,
      error: 'No articles found for briefing',
    });

    const result = await useCase.execute(input);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No articles found for briefing');
  });
});

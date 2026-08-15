import { IS_PUBLIC_KEY } from '@libs/auth';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { QueueService } from '../../libs/queue/queue.service';
import { ConfigService } from '../config/config.service';
import { FeedProfile } from '../shared/types/feed';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';
import { GenerateBriefUseCase } from './usecases/generate-brief.usecase';
import { GenerateCustomBriefUseCase } from './usecases/generate-custom-brief.usecase';

describe('BriefingsController', () => {
  let controller: BriefingsController;
  const mockBriefingsService = mock<BriefingsService>();
  const mockListBriefingsQuery = mock<ListBriefingsQuery>();
  const mockGenerateBriefUseCase = mock<GenerateBriefUseCase>();
  const mockGenerateCustomBriefUseCase = mock<GenerateCustomBriefUseCase>();
  const mockQueueService = mock<QueueService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BriefingsController],
      providers: [
        { provide: BriefingsService, useValue: mockBriefingsService },
        { provide: ListBriefingsQuery, useValue: mockListBriefingsQuery },
        { provide: GenerateBriefUseCase, useValue: mockGenerateBriefUseCase },
        { provide: GenerateCustomBriefUseCase, useValue: mockGenerateCustomBriefUseCase },
        { provide: QueueService, useValue: mockQueueService },
        { provide: ConfigService, useValue: mock<ConfigService>() },
      ],
    }).compile();

    controller = module.get<BriefingsController>(BriefingsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listBriefings', () => {
    it('delegates to ListBriefingsQuery', async () => {
      const expected = {
        briefings: [],
        current_feed_profile: undefined,
        available_profiles: [],
      };
      mockListBriefingsQuery.execute.mockResolvedValue(expected);

      const result = await controller.listBriefings();

      expect(mockListBriefingsQuery.execute).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toBe(expected);
    });

    it('passes feedProfile to query', async () => {
      mockListBriefingsQuery.execute.mockResolvedValue({
        briefings: [],
        current_feed_profile: FeedProfile.DEFAULT,
        available_profiles: [],
      });

      await controller.listBriefings(FeedProfile.DEFAULT);

      expect(mockListBriefingsQuery.execute).toHaveBeenCalledWith(
        FeedProfile.DEFAULT,
        undefined,
      );
    });

    it('parses numeric limit and caps at 100', async () => {
      mockListBriefingsQuery.execute.mockResolvedValue({
        briefings: [],
        current_feed_profile: undefined,
        available_profiles: [],
      });

      await controller.listBriefings(undefined, '200');

      expect(mockListBriefingsQuery.execute).toHaveBeenCalledWith(undefined, 100);
    });

    it('passes parsed limit when within max', async () => {
      mockListBriefingsQuery.execute.mockResolvedValue({
        briefings: [],
        current_feed_profile: undefined,
        available_profiles: [],
      });

      await controller.listBriefings(undefined, '25');

      expect(mockListBriefingsQuery.execute).toHaveBeenCalledWith(undefined, 25);
    });

    it('treats non-numeric limit as undefined', async () => {
      mockListBriefingsQuery.execute.mockResolvedValue({
        briefings: [],
        current_feed_profile: undefined,
        available_profiles: [],
      });

      await controller.listBriefings(undefined, 'abc');

      expect(mockListBriefingsQuery.execute).toHaveBeenCalledWith(undefined, undefined);
    });
  });

  describe('getBriefing', () => {
    it('returns briefing when found', async () => {
      const briefing = {
        id: 'uuid-1',
        brief_markdown: '# Brief',
        generated_at: new Date('2025-01-01'),
        feed_profile: FeedProfile.DEFAULT,
        isCustom: false,
        customTitle: null,
      };
      mockBriefingsService.getBriefById.mockResolvedValue(briefing);

      const result = await controller.getBriefing('uuid-1');

      expect(result).toBe(briefing);
    });

    it('throws NotFoundException for unknown id', async () => {
      mockBriefingsService.getBriefById.mockResolvedValue(null);

      await expect(
        controller.getBriefing('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateBriefing', () => {
    it('delegates to GenerateBriefUseCase and returns result', async () => {
      const expected = { success: true, briefingId: 'brief-uuid' };
      mockGenerateBriefUseCase.execute.mockResolvedValue(expected);

      const result = await controller.generateBriefing({
        feedProfile: FeedProfile.DEFAULT,
      });

      expect(mockGenerateBriefUseCase.execute).toHaveBeenCalledWith({
        feedProfile: FeedProfile.DEFAULT,
      });
      expect(result).toBe(expected);
    });

    it('forwards customPrompts to use case', async () => {
      mockGenerateBriefUseCase.execute.mockResolvedValue({ success: true });
      const input = {
        feedProfile: FeedProfile.DEFAULT,
        customPrompts: { briefSynthesis: 'Custom prompt' },
      };

      await controller.generateBriefing(input);

      expect(mockGenerateBriefUseCase.execute).toHaveBeenCalledWith(input);
    });
  });

  describe('generateCustomBriefing', () => {
    it('delegates to GenerateCustomBriefUseCase and returns job id', async () => {
      const expected = { jobId: 'job-123' };
      const input = {
        articleIds: ['article-1', 'article-2'],
        feedProfile: FeedProfile.DEFAULT,
      };
      mockGenerateCustomBriefUseCase.execute.mockResolvedValue(expected);

      const result = await controller.generateCustomBriefing(input);

      expect(mockGenerateCustomBriefUseCase.execute).toHaveBeenCalledWith(input);
      expect(result).toBe(expected);
    });
  });

  describe('getCustomBriefingJobStatus', () => {
    it('delegates to QueueService', async () => {
      const expected = {
        jobId: 'job-123',
        state: 'completed',
        progress: 100,
        result: { briefingId: 'briefing-uuid' },
        error: undefined,
        data: {},
      };
      mockQueueService.getCustomBriefingJobStatus.mockResolvedValue(expected);

      const result = await controller.getCustomBriefingJobStatus('job-123');

      expect(mockQueueService.getCustomBriefingJobStatus).toHaveBeenCalledWith(
        'job-123',
      );
      expect(result).toBe(expected);
    });
  });

  describe('updateBriefTitle', () => {
    it('is not marked public', () => {
      const isPublic = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        BriefingsController.prototype,
        'updateBriefTitle',
      );
      expect(isPublic).toBeUndefined();
    });

    it('updates the title through BriefingsService', async () => {
      await controller.updateBriefTitle('briefing-uuid', {
        customTitle: 'Updated Title',
      });

      expect(mockBriefingsService.updateBriefTitle).toHaveBeenCalledWith(
        'briefing-uuid',
        'Updated Title',
      );
    });
  });
});

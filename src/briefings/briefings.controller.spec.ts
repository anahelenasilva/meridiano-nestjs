import { QueueService } from '@libs/queue';
import {
  BadRequestException,
  NotFoundException,
  Type,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ConfigService } from '../config/config.service';
import { FeedProfile } from '../shared/types/feed';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';
import { GenerateBriefUseCase } from './usecases/generate-brief.usecase';
import { GenerateCustomBriefUseCase } from './usecases/generate-custom-brief.usecase';

// Same options as the global pipe in main.ts. The body type comes from the
// route's own parameter metadata, so an inline or type-only body (which the
// pipe skips) fails the tests that use this.
const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const validateBody = (
  route: keyof BriefingsController,
  bodyIndex: number,
  body: unknown,
) => {
  const paramTypes: unknown[] = Reflect.getMetadata(
    'design:paramtypes',
    BriefingsController.prototype,
    route,
  );
  return validationPipe.transform(body, {
    type: 'body',
    metatype: paramTypes[bodyIndex] as Type<unknown>,
  });
};

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
        {
          provide: GenerateCustomBriefUseCase,
          useValue: mockGenerateCustomBriefUseCase,
        },
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

      expect(mockListBriefingsQuery.execute).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
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

      expect(mockListBriefingsQuery.execute).toHaveBeenCalledWith(
        undefined,
        100,
      );
    });

    it('passes parsed limit when within max', async () => {
      mockListBriefingsQuery.execute.mockResolvedValue({
        briefings: [],
        current_feed_profile: undefined,
        available_profiles: [],
      });

      await controller.listBriefings(undefined, '25');

      expect(mockListBriefingsQuery.execute).toHaveBeenCalledWith(
        undefined,
        25,
      );
    });

    it('treats non-numeric limit as undefined', async () => {
      mockListBriefingsQuery.execute.mockResolvedValue({
        briefings: [],
        current_feed_profile: undefined,
        available_profiles: [],
      });

      await controller.listBriefings(undefined, 'abc');

      expect(mockListBriefingsQuery.execute).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });

    // TypeORM passes any non-null take straight through, so a negative limit
    // reaches Postgres as `LIMIT -5` (issue #331).
    it.each(['0', '-5'])('rejects limit=%s with a 400', async (limit) => {
      await expect(
        controller.listBriefings(undefined, limit),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockListBriefingsQuery.execute).not.toHaveBeenCalled();
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

      expect(mockGenerateCustomBriefUseCase.execute).toHaveBeenCalledWith(
        input,
      );
      expect(result).toBe(expected);
    });

    describe('body validation', () => {
      const validateCustomBody = (body: unknown) =>
        validateBody('generateCustomBriefing', 0, body);
      const articleId = '5f1c9a4e-2b7d-4c3a-9e8f-1a2b3c4d5e6f';
      // Each rejection test changes one field of this body, so it fails only
      // for the reason it names.
      const validBody = {
        articleIds: [articleId, '8d3e7b21-6a4f-4e9c-b1d2-7f8e9a0b1c2d'],
        feedProfile: FeedProfile.DEFAULT,
      };
      const uuids = (count: number) =>
        Array.from(
          { length: count },
          (_, index) =>
            `5f1c9a4e-2b7d-4c3a-9e8f-${String(index).padStart(12, '0')}`,
        );
      const expectRejected = (overrides: Record<string, unknown>) =>
        expect(
          validateCustomBody({ ...validBody, ...overrides }),
        ).rejects.toBeInstanceOf(BadRequestException);

      it('accepts a valid body without a customPrompt', async () => {
        await expect(validateCustomBody(validBody)).resolves.toEqual(validBody);
      });

      it('rejects articleIds that is not an array', async () => {
        await expectRejected({ articleIds: 'abcd' });
      });

      it('rejects fewer than 2 articleIds', async () => {
        await expectRejected({ articleIds: [articleId] });
      });

      it('rejects more than 10 articleIds', async () => {
        await expectRejected({ articleIds: uuids(11) });
      });

      it('accepts exactly 10 articleIds', async () => {
        const body = { ...validBody, articleIds: uuids(10) };
        await expect(validateCustomBody(body)).resolves.toEqual(body);
      });

      it('rejects an articleId that is not a UUID', async () => {
        await expectRejected({ articleIds: [articleId, 'article-2'] });
      });

      it('rejects a feedProfile outside FeedProfile', async () => {
        await expectRejected({ feedProfile: 'invalid-profile' });
      });

      it('rejects a body with an extra property', async () => {
        await expectRejected({ generateAudio: true });
      });

      it('rejects a customPrompt that is not a string', async () => {
        await expectRejected({ customPrompt: 42 });
      });

      it('rejects a customPrompt longer than 500 characters', async () => {
        await expectRejected({ customPrompt: 'a'.repeat(501) });
      });

      it('accepts a customPrompt of exactly 500 characters', async () => {
        const body = { ...validBody, customPrompt: 'a'.repeat(500) };
        await expect(validateCustomBody(body)).resolves.toEqual(body);
      });
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
    const validateTitleBody = (body: unknown) =>
      validateBody('updateBriefTitle', 1, body);

    it('rejects a customTitle that is not a string', async () => {
      await expect(
        validateTitleBody({ customTitle: 42 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a customTitle longer than 200 characters', async () => {
      await expect(
        validateTitleBody({ customTitle: 'a'.repeat(201) }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a customTitle of exactly 200 characters', async () => {
      await expect(
        validateTitleBody({ customTitle: 'a'.repeat(200) }),
      ).resolves.toEqual({ customTitle: 'a'.repeat(200) });
    });

    it('rejects a body with an extra property', async () => {
      await expect(
        validateTitleBody({ customTitle: 'Title', isCustom: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

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

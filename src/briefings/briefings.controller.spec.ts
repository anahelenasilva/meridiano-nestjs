import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { FeedProfile } from '../shared/types/feed';
import { BriefingsController } from './briefings.controller';
import { BriefingsService } from './briefings.service';
import { ListBriefingsQuery } from './queries/list-briefings.query';

describe('BriefingsController', () => {
  let controller: BriefingsController;
  const mockBriefingsService = mock<BriefingsService>();
  const mockListBriefingsQuery = mock<ListBriefingsQuery>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BriefingsController],
      providers: [
        { provide: BriefingsService, useValue: mockBriefingsService },
        { provide: ListBriefingsQuery, useValue: mockListBriefingsQuery },
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
});

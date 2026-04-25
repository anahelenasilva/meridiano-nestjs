import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock } from 'jest-mock-extended';
import { Repository } from 'typeorm';
import { FeedProfile } from '../shared/types/feed';
import { BriefingsService } from './briefings.service';
import { BriefingEntity } from './entities/briefing.entity';

const mockRepo = mock<Repository<BriefingEntity>>();

describe('BriefingsService', () => {
  let service: BriefingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BriefingsService,
        { provide: getRepositoryToken(BriefingEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<BriefingsService>(BriefingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveBrief', () => {
    it('returns the saved entity id', async () => {
      const entity = { id: 'new-uuid' } as BriefingEntity;
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.saveBrief(
        'content',
        ['article-1'],
        FeedProfile.DEFAULT,
      );

      expect(mockRepo.create).toHaveBeenCalledWith({
        content: 'content',
        articleIds: ['article-1'],
        feedProfile: FeedProfile.DEFAULT,
        isCustom: false,
        customTitle: null,
      });
      expect(result).toBe('new-uuid');
    });

    it('propagates repository save errors', async () => {
      mockRepo.create.mockReturnValue({} as BriefingEntity);
      mockRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.saveBrief('content', [], FeedProfile.DEFAULT),
      ).rejects.toThrow('DB error');
    });
  });

  describe('getAllBriefsMetadata', () => {
    it('returns mapped metadata for all profiles when no filter', async () => {
      const entities: Partial<BriefingEntity>[] = [
        { id: 'id-1', createdAt: new Date('2025-01-02'), feedProfile: 'default' },
        { id: 'id-2', createdAt: new Date('2025-01-01'), feedProfile: 'tech' },
      ];
      mockRepo.find.mockResolvedValue(entities as BriefingEntity[]);

      const result = await service.getAllBriefsMetadata();

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, take: 50 }),
      );
      expect(result).toEqual([
        { id: 'id-1', generated_at: new Date('2025-01-02'), feed_profile: 'default' },
        { id: 'id-2', generated_at: new Date('2025-01-01'), feed_profile: 'tech' },
      ]);
    });

    it('filters by feedProfile when provided', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.getAllBriefsMetadata(FeedProfile.DEFAULT);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { feedProfile: FeedProfile.DEFAULT },
          take: 50,
        }),
      );
    });
  });

  describe('getBriefById', () => {
    it('returns mapped result when entity found', async () => {
      const entity: Partial<BriefingEntity> = {
        id: 'brief-uuid',
        content: '# Brief',
        createdAt: new Date('2025-01-01'),
        feedProfile: 'default',
      };
      mockRepo.findOne.mockResolvedValue(entity as BriefingEntity);

      const result = await service.getBriefById('brief-uuid');

      expect(result).toEqual({
        id: 'brief-uuid',
        brief_markdown: '# Brief',
        generated_at: new Date('2025-01-01'),
        feed_profile: 'default',
      });
    });

    it('returns null when entity not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getBriefById('missing-id');

      expect(result).toBeNull();
    });
  });
});

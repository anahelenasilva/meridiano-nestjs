import { Repository } from 'typeorm';
import { mock } from 'jest-mock-extended';
import { DigestsService } from './digests.service';
import { DigestEntity } from './entities/digest.entity';
import { DigestItem } from './entities/digest.types';

describe('DigestsService', () => {
  let service: DigestsService;
  let mockRepository: ReturnType<typeof mock<Repository<DigestEntity>>>;

  beforeEach(() => {
    mockRepository = mock<Repository<DigestEntity>>();
    service = new DigestsService(mockRepository);
  });

  describe('saveDigest', () => {
    it('creates and saves a digest entity from the given items', async () => {
      const items: DigestItem[] = [
        { articleId: 'a1', title: 'Title 1', feedSource: 'Source 1', url: 'https://example.com/1' },
      ];
      const created = { items } as DigestEntity;
      const saved = { id: 'digest-1', items, createdAt: new Date() } as DigestEntity;

      mockRepository.create.mockReturnValue(created);
      mockRepository.save.mockResolvedValue(saved);

      const result = await service.saveDigest(items);

      expect(mockRepository.create).toHaveBeenCalledWith({ items });
      expect(mockRepository.save).toHaveBeenCalledWith(created);
      expect(result).toBe('digest-1');
    });

    it('persists an empty items array as-is', async () => {
      const created = { items: [] } as unknown as DigestEntity;
      const saved = { id: 'digest-2', items: [], createdAt: new Date() } as DigestEntity;

      mockRepository.create.mockReturnValue(created);
      mockRepository.save.mockResolvedValue(saved);

      const result = await service.saveDigest([]);

      expect(mockRepository.create).toHaveBeenCalledWith({ items: [] });
      expect(result).toBe('digest-2');
    });

    it('propagates the error when the repository fails to save', async () => {
      const items: DigestItem[] = [
        { articleId: 'a1', title: 'Title 1', feedSource: 'Source 1', url: 'https://example.com/1' },
      ];
      const created = { items } as DigestEntity;

      mockRepository.create.mockReturnValue(created);
      mockRepository.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.saveDigest(items)).rejects.toThrow('DB connection lost');
    });
  });

  describe('findLatest', () => {
    it('returns the newest digest ordered by created_at DESC', async () => {
      const items: DigestItem[] = [
        { articleId: 'a1', title: 'Title 1', feedSource: 'Source 1', url: 'https://example.com/1' },
      ];
      const latest = { id: 'digest-1', items, createdAt: new Date() } as DigestEntity;

      mockRepository.find.mockResolvedValue([latest]);

      const result = await service.findLatest();

      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 1,
      });
      expect(result).toBe(latest);
    });

    it('returns null when no digest exists', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findLatest();

      expect(result).toBeNull();
    });

    it('propagates the error when the repository fails to query', async () => {
      mockRepository.find.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.findLatest()).rejects.toThrow('DB connection lost');
    });
  });
});

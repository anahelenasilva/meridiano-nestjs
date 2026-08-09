import { API_KEY_ALLOWED_KEY } from '@libs/auth';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { NewsDigestController } from './news-digest.controller';
import { NewsDigestService } from './news-digest.service';

describe('NewsDigestController', () => {
  let controller: NewsDigestController;
  const mockNewsDigestService = mock<NewsDigestService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsDigestController],
      providers: [{ provide: NewsDigestService, useValue: mockNewsDigestService }],
    }).compile();

    controller = module.get<NewsDigestController>(NewsDigestController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getLatest', () => {
    it('is marked @ApiKeyAllowed()', () => {
      // SetMetadata stores method-level metadata on the descriptor's function
      // value itself, not on (prototype, propertyKey) — that pair form always
      // returns undefined here, so the lookup target must be the function.
      const allowed = Reflect.getMetadata(
        API_KEY_ALLOWED_KEY,
        NewsDigestController.prototype.getLatest,
      );
      expect(allowed).toBe(true);
    });

    it('returns the latest digest items', async () => {
      const items = [
        { articleId: 'a1', title: 'Title 1', feedSource: 'Source 1', url: 'https://example.com/1' },
      ];
      mockNewsDigestService.getLatestDigest.mockResolvedValue(items);

      const result = await controller.getLatest();

      expect(mockNewsDigestService.getLatestDigest).toHaveBeenCalled();
      expect(result).toBe(items);
    });

    it('returns an empty array when no digest exists', async () => {
      mockNewsDigestService.getLatestDigest.mockResolvedValue([]);

      const result = await controller.getLatest();

      expect(result).toEqual([]);
    });
  });
});

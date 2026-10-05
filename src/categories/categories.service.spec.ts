import { DatabaseService } from '@libs/database';
import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { CategoriesService } from './categories.service';
import { CATEGORY_COLORS } from './category-colors';

describe('CategoriesService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
  };
  let service: CategoriesService;

  const usedColorsAre = (colors: string[]) =>
    mockDb.all.mockImplementationOnce((sql, params, callback) => {
      callback(
        null,
        colors.map((color) => ({ color })),
      );
    });

  const getFailsWith = (err: Error) =>
    mockDb.get.mockImplementationOnce((sql, params, callback) => {
      callback(err);
    });

  const duplicateKeyError = () =>
    Object.assign(new Error('duplicate'), { code: '23505' });

  const categoryRow = {
    id: 'category-1',
    name: 'tech',
    color: CATEGORY_COLORS.blue,
    created_at: '2026-08-16T12:00:00.000Z',
    updated_at: '2026-08-16T12:00:00.000Z',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new CategoriesService(mockDatabaseService);
  });

  describe('createCategory', () => {
    it('inserts the category with a not-yet-used palette color', async () => {
      // Only cyan is unused.
      usedColorsAre([
        CATEGORY_COLORS.pink,
        CATEGORY_COLORS.blue,
        CATEGORY_COLORS.emerald,
        CATEGORY_COLORS.amber,
        CATEGORY_COLORS.violet,
      ]);
      mockDb.get.mockImplementationOnce((sql, params: string[], callback) => {
        callback(null, {
          id: 'category-1',
          name: params[0],
          color: params[1],
          created_at: '2026-08-16T12:00:00.000Z',
          updated_at: '2026-08-16T12:00:00.000Z',
        });
      });

      await expect(service.createCategory('gaming')).resolves.toEqual({
        id: 'category-1',
        name: 'gaming',
        color: CATEGORY_COLORS.cyan,
        createdAt: new Date('2026-08-16T12:00:00.000Z'),
        updatedAt: new Date('2026-08-16T12:00:00.000Z'),
      });
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO categories'),
        ['gaming', CATEGORY_COLORS.cyan],
        expect.any(Function),
      );
    });

    it('rejects a duplicate name with a ConflictException', async () => {
      usedColorsAre([]);
      getFailsWith(duplicateKeyError());

      await expect(service.createCategory('tech')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects any other insert failure with an InternalServerErrorException', async () => {
      usedColorsAre([]);
      getFailsWith(new Error('connection lost'));

      await expect(service.createCategory('tech')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('listCategories', () => {
    it('maps each row and reads channel_count as a number', async () => {
      mockDb.all.mockImplementationOnce((sql, params, callback) => {
        callback(null, [{ ...categoryRow, channel_count: '3' }]);
      });

      await expect(service.listCategories()).resolves.toEqual([
        expect.objectContaining({ id: 'category-1', channelCount: 3 }),
      ]);
    });
  });

  describe('getCategoryByName', () => {
    it('resolves null when no category has that name', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, undefined);
      });

      await expect(service.getCategoryByName('missing')).resolves.toBeNull();
    });

    it('rejects a lookup failure with an InternalServerErrorException', async () => {
      getFailsWith(new Error('connection lost'));

      await expect(service.getCategoryByName('tech')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('renameCategory', () => {
    it('resolves the renamed category', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, { ...categoryRow, name: 'science' });
      });

      await expect(
        service.renameCategory('category-1', 'science'),
      ).resolves.toEqual(expect.objectContaining({ name: 'science' }));
    });

    it('rejects an unknown id with a NotFoundException', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, undefined);
      });

      await expect(
        service.renameCategory('missing', 'science'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects a duplicate name with a ConflictException', async () => {
      getFailsWith(duplicateKeyError());

      await expect(
        service.renameCategory('category-1', 'tech'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('deleteCategory', () => {
    const deleteChanges = (changes: number) =>
      mockDb.run.mockImplementationOnce(function (sql, params, callback) {
        callback.call({ changes }, null);
      });

    it('resolves when a row is deleted', async () => {
      deleteChanges(1);

      await expect(
        service.deleteCategory('category-1'),
      ).resolves.toBeUndefined();
    });

    it('rejects an unknown id with a NotFoundException', async () => {
      deleteChanges(0);

      await expect(service.deleteCategory('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

import { DatabaseService } from '@libs/database';
import {
  ConflictException,
  InternalServerErrorException,
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
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(Object.assign(new Error('duplicate'), { code: '23505' }));
      });

      await expect(service.createCategory('tech')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects any other insert failure with an InternalServerErrorException', async () => {
      usedColorsAre([]);
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(new Error('connection lost'));
      });

      await expect(service.createCategory('tech')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});

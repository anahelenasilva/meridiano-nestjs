/**
 * E2E tests for the categories management API (issue #207).
 *
 * These exercise the HTTP boundary with a mocked CategoriesService but the
 * real commands/query, so the auto-color-assignment logic runs for real.
 * Two behaviors are enforced in SQL, not in the command layer, so here they
 * are only asserted as HTTP contract (the service is driven to the failing
 * outcome): case-insensitive name uniqueness (unique index on LOWER(name))
 * and delete-detaches-only (ON DELETE CASCADE on channel_categories). The
 * SQL itself is verified honestly once a test database is available; see the
 * note in the issue's testing decisions.
 */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import request from 'supertest';
import { App } from 'supertest/types';
import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_PALETTE,
} from '../src/categories/category-colors';
import { CreateCategoryCommand } from '../src/categories/commands/create-category.command';
import { DeleteCategoryCommand } from '../src/categories/commands/delete-category.command';
import { RenameCategoryCommand } from '../src/categories/commands/rename-category.command';
import { Category } from '../src/categories/domain/category';
import { ListCategoriesQuery } from '../src/categories/queries/list-categories.query';

describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let service: MockProxy<CategoriesService>;

  function buildCategory(overrides: Partial<Category> = {}): Category {
    return {
      id: 'category-1',
      name: 'tech',
      color: CATEGORY_COLORS.blue,
      createdAt: new Date('2026-08-16T12:00:00.000Z'),
      updatedAt: new Date('2026-08-16T12:00:00.000Z'),
      ...overrides,
    };
  }

  beforeAll(async () => {
    service = mock<CategoriesService>();

    moduleFixture = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        ListCategoriesQuery,
        CreateCategoryCommand,
        RenameCategoryCommand,
        DeleteCategoryCommand,
        { provide: CategoriesService, useValue: service },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service.getUsedColors.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  describe('GET /api/youtube/categories', () => {
    it('returns categories with their channel counts', async () => {
      service.listCategories.mockResolvedValue([
        { ...buildCategory(), channelCount: 3 },
        {
          ...buildCategory({
            id: 'category-2',
            name: 'travel',
            color: CATEGORY_COLORS.emerald,
          }),
          channelCount: 0,
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/api/youtube/categories')
        .expect(200);

      expect(response.body).toEqual([
        {
          id: 'category-1',
          name: 'tech',
          color: CATEGORY_COLORS.blue,
          channelCount: 3,
        },
        {
          id: 'category-2',
          name: 'travel',
          color: CATEGORY_COLORS.emerald,
          channelCount: 0,
        },
      ]);
    });
  });

  describe('POST /api/youtube/categories', () => {
    it('creates a category and returns its assigned color', async () => {
      service.createCategory.mockImplementation((name, color) =>
        Promise.resolve(buildCategory({ id: 'new', name, color })),
      );

      const response = await request(app.getHttpServer())
        .post('/api/youtube/categories')
        .send({ name: 'gaming' })
        .expect(201);

      expect(response.body).toEqual({
        id: 'new',
        name: 'gaming',
        color: expect.any(String),
      });
      expect(CATEGORY_COLOR_PALETTE).toContain(response.body.color);
    });

    it('assigns a not-yet-used palette color', async () => {
      // Every color but cyan is taken, so cyan must be chosen.
      service.getUsedColors.mockResolvedValue([
        CATEGORY_COLORS.pink,
        CATEGORY_COLORS.blue,
        CATEGORY_COLORS.emerald,
        CATEGORY_COLORS.amber,
        CATEGORY_COLORS.violet,
      ]);
      service.createCategory.mockImplementation((name, color) =>
        Promise.resolve(buildCategory({ name, color })),
      );

      await request(app.getHttpServer())
        .post('/api/youtube/categories')
        .send({ name: 'gaming' })
        .expect(201);

      expect(service.createCategory).toHaveBeenCalledWith(
        'gaming',
        CATEGORY_COLORS.cyan,
      );
    });

    it('rejects a case-insensitively duplicate name with 409', async () => {
      service.createCategory.mockRejectedValue(
        new ConflictException('A category named "tech" already exists'),
      );

      await request(app.getHttpServer())
        .post('/api/youtube/categories')
        .send({ name: 'Tech' })
        .expect(409);
    });

    it('rejects an empty name with 400', async () => {
      await request(app.getHttpServer())
        .post('/api/youtube/categories')
        .send({ name: '' })
        .expect(400);

      expect(service.createCategory).not.toHaveBeenCalled();
    });

    it('rejects a whitespace-only name with 400 after trimming', async () => {
      await request(app.getHttpServer())
        .post('/api/youtube/categories')
        .send({ name: '   ' })
        .expect(400);

      expect(service.createCategory).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/youtube/categories/:id', () => {
    it('renames a category and returns the updated row', async () => {
      service.renameCategory.mockResolvedValue(
        buildCategory({ id: 'category-1', name: 'technology' }),
      );

      const response = await request(app.getHttpServer())
        .patch('/api/youtube/categories/category-1')
        .send({ name: 'technology' })
        .expect(200);

      expect(response.body).toEqual({
        id: 'category-1',
        name: 'technology',
        color: CATEGORY_COLORS.blue,
      });
      expect(service.renameCategory).toHaveBeenCalledWith(
        'category-1',
        'technology',
      );
    });

    it('returns 404 renaming a category that does not exist', async () => {
      service.renameCategory.mockRejectedValue(
        new NotFoundException('Category missing not found'),
      );

      await request(app.getHttpServer())
        .patch('/api/youtube/categories/missing')
        .send({ name: 'technology' })
        .expect(404);
    });
  });

  describe('DELETE /api/youtube/categories/:id', () => {
    it('deletes only the category and returns 204', async () => {
      service.deleteCategory.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/api/youtube/categories/category-1')
        .expect(204);

      expect(service.deleteCategory).toHaveBeenCalledWith('category-1');
    });

    it('returns 404 deleting a category that does not exist', async () => {
      service.deleteCategory.mockRejectedValue(
        new NotFoundException('Category missing not found'),
      );

      await request(app.getHttpServer())
        .delete('/api/youtube/categories/missing')
        .expect(404);
    });
  });
});

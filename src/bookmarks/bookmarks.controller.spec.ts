import { BadRequestException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { ArticlesService } from '../articles/articles.service';
import { DBArticle } from '../articles/article.entity';
import { CreateBookmarkDto } from './bookmark.entity';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';

const OWNER_ID = '11111111-1111-1111-1111-111111111111';
const ATTACKER_ID = '99999999-9999-9999-9999-999999999999';
const ARTICLE_ID = '22222222-2222-2222-2222-222222222222';

describe('BookmarksController', () => {
  const mockBookmarksService = mock<BookmarksService>();
  const mockArticlesService = mock<ArticlesService>();
  const controller = new BookmarksController(
    mockBookmarksService,
    mockArticlesService,
  );
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addBookmark', () => {
    beforeEach(() => {
      mockArticlesService.getArticleById.mockResolvedValue({
        id: ARTICLE_ID,
      } as DBArticle);
    });

    it('derives ownership from the authenticated user, not the request body', async () => {
      mockBookmarksService.addBookmark.mockResolvedValue({
        bookmark: {
          id: 'bookmark-1',
          user_id: OWNER_ID,
          article_id: ARTICLE_ID,
          created_at: new Date('2026-05-17T12:00:00.000Z'),
        },
        wasCreated: true,
      });

      const result = await controller.addBookmark(
        { id: OWNER_ID },
        { article_id: ARTICLE_ID },
      );

      expect(mockBookmarksService.addBookmark).toHaveBeenCalledWith(
        OWNER_ID,
        ARTICLE_ID,
      );
      expect(result).toEqual({
        id: 'bookmark-1',
        article_id: ARTICLE_ID,
        created_at: new Date('2026-05-17T12:00:00.000Z'),
        already_bookmarked: false,
      });
      expect(result).not.toHaveProperty('user_id');
    });

    it('returns already_bookmarked: true with the existing bookmark on a duplicate, without erroring', async () => {
      mockBookmarksService.addBookmark.mockResolvedValue({
        bookmark: {
          id: 'bookmark-1',
          user_id: OWNER_ID,
          article_id: ARTICLE_ID,
          created_at: new Date('2026-05-17T12:00:00.000Z'),
        },
        wasCreated: false,
      });

      const result = await controller.addBookmark(
        { id: OWNER_ID },
        { article_id: ARTICLE_ID },
      );

      expect(result).toEqual({
        id: 'bookmark-1',
        article_id: ARTICLE_ID,
        created_at: new Date('2026-05-17T12:00:00.000Z'),
        already_bookmarked: true,
      });
    });

    it('propagates a known HttpException unchanged instead of masking it', async () => {
      mockBookmarksService.addBookmark.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.addBookmark({ id: OWNER_ID }, { article_id: ARTICLE_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('wraps an unexpected error as a generic BadRequestException', async () => {
      mockBookmarksService.addBookmark.mockRejectedValue(
        new Error('connection reset'),
      );

      await expect(
        controller.addBookmark({ id: OWNER_ID }, { article_id: ARTICLE_ID }),
      ).rejects.toThrow(new BadRequestException('Failed to add bookmark'));
    });

    it('rejects a client-supplied user_id at validation time', async () => {
      await expect(
        validationPipe.transform(
          {
            article_id: ARTICLE_ID,
            user_id: ATTACKER_ID,
          },
          {
            type: 'body',
            metatype: CreateBookmarkDto,
          },
        ),
      ).rejects.toMatchObject({
        response: {
          message: expect.arrayContaining(['property user_id should not exist']),
        },
      });
    });
  });

  describe('removeBookmark', () => {
    it('scopes removal to the authenticated user', async () => {
      mockBookmarksService.removeBookmark.mockResolvedValue(true);

      const result = await controller.removeBookmark(
        { id: OWNER_ID },
        { article_id: ARTICLE_ID },
        ARTICLE_ID,
      );

      expect(mockBookmarksService.removeBookmark).toHaveBeenCalledWith(
        OWNER_ID,
        ARTICLE_ID,
      );
      expect(result).toEqual({
        success: true,
        message: 'Bookmark removed successfully',
      });
    });

    it('rejects a client-supplied user_id query param', async () => {
      await expect(
        controller.removeBookmark(
          { id: OWNER_ID },
          { article_id: ARTICLE_ID, user_id: ATTACKER_ID },
          ARTICLE_ID,
        ),
      ).rejects.toMatchObject({
        response: {
          message: 'property user_id should not exist',
        },
      });
    });
  });

  describe('getBookmarks', () => {
    it('lists bookmarks scoped to the authenticated user', async () => {
      mockBookmarksService.getBookmarks.mockResolvedValue({
        bookmarks: [],
        total: 0,
        page: 1,
        perPage: 20,
      });

      await controller.getBookmarks({ id: OWNER_ID }, {});

      expect(mockBookmarksService.getBookmarks).toHaveBeenCalledWith(
        OWNER_ID,
        1,
        20,
      );
    });

    it('rejects a client-supplied user_id query param', async () => {
      await expect(
        controller.getBookmarks({ id: OWNER_ID }, { user_id: ATTACKER_ID }),
      ).rejects.toMatchObject({
        response: {
          message: 'property user_id should not exist',
        },
      });
    });
  });

  describe('checkBookmark', () => {
    it('checks bookmark state for the authenticated user', async () => {
      mockBookmarksService.isBookmarked.mockResolvedValue(true);

      const result = await controller.checkBookmark(
        { id: OWNER_ID },
        {},
        ARTICLE_ID,
      );

      expect(mockBookmarksService.isBookmarked).toHaveBeenCalledWith(
        OWNER_ID,
        ARTICLE_ID,
      );
      expect(result).toEqual({ bookmarked: true });
    });

    it('rejects a client-supplied user_id query param', async () => {
      await expect(
        controller.checkBookmark(
          { id: OWNER_ID },
          { user_id: ATTACKER_ID },
          ARTICLE_ID,
        ),
      ).rejects.toMatchObject({
        response: {
          message: 'property user_id should not exist',
        },
      });
    });
  });

  describe('getBookmarkCount', () => {
    it('counts bookmarks for the authenticated user', async () => {
      mockBookmarksService.getBookmarkCount.mockResolvedValue(3);

      const result = await controller.getBookmarkCount({ id: OWNER_ID }, {});

      expect(mockBookmarksService.getBookmarkCount).toHaveBeenCalledWith(
        OWNER_ID,
      );
      expect(result).toEqual({ count: 3 });
    });

    it('rejects a client-supplied user_id query param', async () => {
      await expect(
        controller.getBookmarkCount(
          { id: OWNER_ID },
          { user_id: ATTACKER_ID },
        ),
      ).rejects.toMatchObject({
        response: {
          message: 'property user_id should not exist',
        },
      });
    });
  });
});

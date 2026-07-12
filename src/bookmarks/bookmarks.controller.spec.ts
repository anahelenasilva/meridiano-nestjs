import { ValidationPipe } from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { ArticlesService } from '../articles/articles.service';
import { DBArticle } from '../articles/article.entity';
import { NotesReadService } from '../notes/notes-read.service';
import { CreateBookmarkDto } from './bookmark.entity';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';

const OWNER_ID = '11111111-1111-1111-1111-111111111111';
const ATTACKER_ID = '99999999-9999-9999-9999-999999999999';
const ARTICLE_ID = '22222222-2222-2222-2222-222222222222';

describe('BookmarksController', () => {
  const mockBookmarksService = mock<BookmarksService>();
  const mockArticlesService = mock<ArticlesService>();
  const mockNotesReadService = mock<NotesReadService>();
  const controller = new BookmarksController(
    mockBookmarksService,
    mockArticlesService,
    mockNotesReadService,
  );
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(new Map());
  });

  describe('addBookmark', () => {
    it('derives ownership from the authenticated user, not the request body', async () => {
      mockArticlesService.getArticleById.mockResolvedValue({
        id: ARTICLE_ID,
      } as DBArticle);
      mockBookmarksService.addBookmark.mockResolvedValue({
        id: 'bookmark-1',
        user_id: OWNER_ID,
        article_id: ARTICLE_ID,
        created_at: new Date('2026-05-17T12:00:00.000Z'),
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
      });
      expect(result).not.toHaveProperty('user_id');
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
      expect(mockNotesReadService.getActiveNotesBySourceIds).toHaveBeenCalledWith(
        OWNER_ID,
        'article',
        [],
      );
    });

    it('embeds article notes via a single bulk lookup and keeps the note nested under article', async () => {
      mockBookmarksService.getBookmarks.mockResolvedValue({
        bookmarks: [
          {
            id: 'bookmark-1',
            user_id: OWNER_ID,
            article_id: ARTICLE_ID,
            created_at: new Date('2026-05-17T12:10:00.000Z'),
            article: {
              id: ARTICLE_ID,
              url: 'https://example.com/article',
              title: 'Saved article',
              published_date: new Date('2026-05-17T10:00:00.000Z'),
              feed_source: 'Source',
              raw_content: 'raw',
              processed_content: 'processed',
              embedding: null,
              impact_rating: 5,
              feed_profile: 'TECHNOLOGY',
              image_url: null,
              created_at: new Date('2026-05-17T10:00:00.000Z'),
              categories: null,
            },
          },
        ],
        total: 1,
        page: 1,
        perPage: 20,
      });
      mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(
        new Map([
          [
            ARTICLE_ID,
            {
              id: 'note-1',
              user_id: OWNER_ID,
              source_type: 'article',
              source_id: ARTICLE_ID,
              content: 'Saved thought',
              created_at: new Date('2026-05-17T12:00:00.000Z'),
              updated_at: new Date('2026-05-17T12:05:00.000Z'),
            },
          ],
        ]),
      );

      const result = await controller.getBookmarks({ id: OWNER_ID }, {});

      expect(
        mockNotesReadService.getActiveNotesBySourceIds,
      ).toHaveBeenCalledTimes(1);
      expect(mockNotesReadService.getActiveNotesBySourceIds).toHaveBeenCalledWith(
        OWNER_ID,
        'article',
        [ARTICLE_ID],
      );
      const articleWithNote = result.bookmarks[0].article as DBArticle & {
        note: {
          id: string;
          content: string;
          created_at: Date;
          updated_at: Date;
        } | null;
      };
      expect(articleWithNote.note).toEqual({
        id: 'note-1',
        content: 'Saved thought',
        created_at: new Date('2026-05-17T12:00:00.000Z'),
        updated_at: new Date('2026-05-17T12:05:00.000Z'),
      });
      expect(result.bookmarks[0]).not.toHaveProperty('note');
      expect(articleWithNote.note).not.toHaveProperty('user_id');
      expect(articleWithNote.note).not.toHaveProperty('source_id');
      expect(articleWithNote.note).not.toHaveProperty('source_type');
    });

    it('sets article.note to null when the bookmark article has no active note', async () => {
      mockBookmarksService.getBookmarks.mockResolvedValue({
        bookmarks: [
          {
            id: 'bookmark-1',
            user_id: OWNER_ID,
            article_id: ARTICLE_ID,
            created_at: new Date('2026-05-17T12:10:00.000Z'),
            article: {
              id: ARTICLE_ID,
              url: 'https://example.com/article',
              title: 'Saved article',
              published_date: new Date('2026-05-17T10:00:00.000Z'),
              feed_source: 'Source',
              raw_content: 'raw',
              processed_content: 'processed',
              embedding: null,
              impact_rating: 5,
              feed_profile: 'TECHNOLOGY',
              image_url: null,
              created_at: new Date('2026-05-17T10:00:00.000Z'),
              categories: null,
            },
          },
        ],
        total: 1,
        page: 1,
        perPage: 20,
      });
      mockNotesReadService.getActiveNotesBySourceIds.mockResolvedValue(new Map());

      const result = await controller.getBookmarks({ id: OWNER_ID }, {});
      const articleWithNote = result.bookmarks[0].article as DBArticle & {
        note: null;
      };

      expect(articleWithNote.note).toBeNull();
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

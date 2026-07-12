import { CurrentUser, type AuthenticatedUser } from '@libs/auth';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ArticlesService } from '../articles/articles.service';
import { attachNotes } from '../notes/attach-notes';
import { NotesReadService } from '../notes/notes-read.service';
import {
  BookmarkResponseDto,
  BookmarkWithArticleResponseDto,
  CreateBookmarkDto,
} from './bookmark.entity';
import { BookmarksService } from './bookmarks.service';

@Controller('api/bookmarks')
export class BookmarksController {
  constructor(
    private readonly bookmarksService: BookmarksService,
    private readonly articlesService: ArticlesService,
    private readonly notesReadService: NotesReadService,
  ) {}

  @Post()
  async addBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createBookmarkDto: CreateBookmarkDto,
  ) {
    const article = await this.articlesService.getArticleById(
      createBookmarkDto.article_id,
    );
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    try {
      const bookmark = await this.bookmarksService.addBookmark(
        user.id,
        createBookmarkDto.article_id,
      );

      if (!bookmark) {
        throw new BadRequestException('Article is already bookmarked');
      }

      return new BookmarkResponseDto(bookmark);
    } catch (error) {
      console.error('Error adding bookmark:', error);

      throw new BadRequestException('Failed to add bookmark');
    }
  }

  @Delete()
  async removeBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
    @Query('article_id', ParseUUIDPipe) articleId: string,
  ) {
    this.rejectClientSuppliedUserId(query);

    const removed = await this.bookmarksService.removeBookmark(
      user.id,
      articleId,
    );

    if (!removed) {
      throw new NotFoundException('Bookmark not found');
    }

    return { success: true, message: 'Bookmark removed successfully' };
  }

  @Get()
  async getBookmarks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    this.rejectClientSuppliedUserId(query);

    const pageNum = page ? parseInt(page, 10) : 1;
    const perPageNum = perPage ? parseInt(perPage, 10) : 20;

    if (pageNum < 1 || perPageNum < 1 || perPageNum > 100) {
      throw new BadRequestException(
        'Invalid pagination parameters. Page must be >= 1, per_page must be between 1 and 100',
      );
    }

    const result = await this.bookmarksService.getBookmarks(
      user.id,
      pageNum,
      perPageNum,
    );
    const notesBySourceId = await this.notesReadService.getActiveNotesBySourceIds(
      user.id,
      'article',
      result.bookmarks.map((bookmark) => bookmark.article.id),
    );
    const articlesWithNotes = attachNotes(
      result.bookmarks.map((bookmark) => bookmark.article),
      (article) => article.id,
      notesBySourceId,
    );

    return {
      bookmarks: result.bookmarks.map(
        (bookmark, index) =>
          new BookmarkWithArticleResponseDto({
            ...bookmark,
            article: articlesWithNotes[index],
          }),
      ),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: Math.ceil(result.total / result.perPage),
    };
  }

  @Get('check/:articleId')
  async checkBookmark(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
    @Param('articleId', ParseUUIDPipe) articleId: string,
  ) {
    this.rejectClientSuppliedUserId(query);

    const isBookmarked = await this.bookmarksService.isBookmarked(
      user.id,
      articleId,
    );

    return { bookmarked: isBookmarked };
  }

  @Get('count')
  async getBookmarkCount(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: Record<string, string | undefined>,
  ) {
    this.rejectClientSuppliedUserId(query);

    const count = await this.bookmarksService.getBookmarkCount(user.id);

    return { count };
  }

  private rejectClientSuppliedUserId(query: Record<string, string | undefined>) {
    if (query.user_id !== undefined) {
      throw new BadRequestException('property user_id should not exist');
    }
  }
}

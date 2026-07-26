import { CurrentUser, type AuthenticatedUser } from '@libs/auth';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  ApiAuthErrorResponse,
  ApiValidationErrorResponse,
} from '../shared/swagger/api-error-response.decorators';
import { ArticlesService } from '../articles/articles.service';
import { attachNotes } from '../notes/attach-notes';
import { NotesReadService } from '../notes/notes-read.service';
import {
  AddBookmarkResponseDto,
  BookmarkWithArticleResponseDto,
  CreateBookmarkDto,
} from './bookmark.entity';
import { BookmarksService } from './bookmarks.service';

@Controller('api/bookmarks')
@ApiAuthErrorResponse()
export class BookmarksController {
  constructor(
    private readonly bookmarksService: BookmarksService,
    private readonly articlesService: ArticlesService,
    private readonly notesReadService: NotesReadService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Bookmark an article for the authenticated user' })
  @ApiCreatedResponse({ type: AddBookmarkResponseDto })
  @ApiValidationErrorResponse()
  @ApiNotFoundResponse({ description: 'Article not found' })
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
      const { bookmark, wasCreated } = await this.bookmarksService.addBookmark(
        user.id,
        createBookmarkDto.article_id,
      );

      return new AddBookmarkResponseDto(bookmark, !wasCreated);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      console.error('Error adding bookmark:', error);

      throw new BadRequestException('Failed to add bookmark');
    }
  }

  @Delete()
  @ApiOperation({ summary: 'Remove a bookmark for the authenticated user' })
  @ApiOkResponse({ description: 'Bookmark removed successfully' })
  @ApiNotFoundResponse({ description: 'Bookmark not found' })
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
  @ApiOperation({ summary: "List the authenticated user's bookmarks" })
  @ApiOkResponse({ description: 'Paginated list of bookmarks with their articles' })
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
  @ApiOperation({ summary: 'Check whether an article is bookmarked by the authenticated user' })
  @ApiOkResponse({ description: 'Bookmark status for the article' })
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
  @ApiOperation({ summary: "Get the authenticated user's total bookmark count" })
  @ApiOkResponse({ description: 'Bookmark count' })
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

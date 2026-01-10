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
import { UsersService } from '../users/users.service';
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
    private readonly usersService: UsersService,
    private readonly articlesService: ArticlesService,
  ) { }

  @Post()
  async addBookmark(@Body() createBookmarkDto: CreateBookmarkDto) {
    const user = await this.usersService.getUserById(createBookmarkDto.user_id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const article = await this.articlesService.getArticleById(
      createBookmarkDto.article_id,
    );
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    try {
      const bookmark = await this.bookmarksService.addBookmark(
        createBookmarkDto.user_id,
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
    @Query('user_id', ParseUUIDPipe) userId: string,
    @Query('article_id', ParseUUIDPipe) articleId: string,
  ) {
    const removed = await this.bookmarksService.removeBookmark(userId, articleId);

    if (!removed) {
      throw new NotFoundException('Bookmark not found');
    }

    return { success: true, message: 'Bookmark removed successfully' };
  }

  @Get()
  async getBookmarks(
    @Query('user_id', ParseUUIDPipe) userId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const perPageNum = perPage ? parseInt(perPage, 10) : 20;

    if (pageNum < 1 || perPageNum < 1 || perPageNum > 100) {
      throw new BadRequestException(
        'Invalid pagination parameters. Page must be >= 1, per_page must be between 1 and 100',
      );
    }

    const result = await this.bookmarksService.getBookmarks(
      userId,
      pageNum,
      perPageNum,
    );

    return {
      bookmarks: result.bookmarks.map(
        (bookmark) => new BookmarkWithArticleResponseDto(bookmark),
      ),
      total: result.total,
      page: result.page,
      perPage: result.perPage,
      totalPages: Math.ceil(result.total / result.perPage),
    };
  }

  @Get('check/:articleId')
  async checkBookmark(
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Query('user_id', ParseUUIDPipe) userId: string,
  ) {
    const isBookmarked = await this.bookmarksService.isBookmarked(
      userId,
      articleId,
    );

    return { bookmarked: isBookmarked };
  }

  @Get('count')
  async getBookmarkCount(@Query('user_id', ParseUUIDPipe) userId: string) {
    const count = await this.bookmarksService.getBookmarkCount(userId);

    return { count };
  }
}

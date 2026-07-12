import { IsNotEmpty, IsUUID } from 'class-validator';
import { DBArticle } from '../articles/article.entity';

export interface Bookmark {
  id: string;
  user_id: string;
  article_id: string;
  created_at: Date;
}

export interface AddBookmarkResult {
  bookmark: Bookmark;
  wasCreated: boolean;
}

export class CreateBookmarkDto {
  @IsUUID('4', { message: 'Invalid article ID format' })
  @IsNotEmpty({ message: 'Article ID is required' })
  article_id: string;
}

export class BookmarkResponseDto {
  id: string;
  article_id: string;
  created_at: Date;

  constructor(bookmark: Bookmark) {
    this.id = bookmark.id;
    this.article_id = bookmark.article_id;
    this.created_at = bookmark.created_at;
  }
}

export class AddBookmarkResponseDto extends BookmarkResponseDto {
  already_bookmarked: boolean;

  constructor(bookmark: Bookmark, alreadyBookmarked: boolean) {
    super(bookmark);
    this.already_bookmarked = alreadyBookmarked;
  }
}

export interface BookmarkWithArticle extends Bookmark {
  article: DBArticle;
}

export class BookmarkWithArticleResponseDto extends BookmarkResponseDto {
  article: DBArticle;

  constructor(bookmark: BookmarkWithArticle) {
    super(bookmark);
    this.article = bookmark.article;
  }
}

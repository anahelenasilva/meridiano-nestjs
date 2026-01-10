import { IsNotEmpty, IsUUID } from 'class-validator';
import { DBArticle } from '../articles/article.entity';

export interface Bookmark {
  id: string;
  user_id: string;
  article_id: string;
  created_at: Date;
}

export class CreateBookmarkDto {
  @IsUUID('4', { message: 'Invalid user ID format' })
  @IsNotEmpty({ message: 'User ID is required' })
  user_id: string;

  @IsUUID('4', { message: 'Invalid article ID format' })
  @IsNotEmpty({ message: 'Article ID is required' })
  article_id: string;
}

export class BookmarkResponseDto {
  id: string;
  user_id: string;
  article_id: string;
  created_at: Date;

  constructor(bookmark: Bookmark) {
    this.id = bookmark.id;
    this.user_id = bookmark.user_id;
    this.article_id = bookmark.article_id;
    this.created_at = bookmark.created_at;
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

import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ArticlePage } from '../articles.service';
import type { ArticleFilter } from '../helpers/article-filter';

export const MAX_PER_PAGE = 100;

// Caps page so the OFFSET the service computes as (page - 1) * perPage stays a
// number Postgres accepts as a bigint: unbounded, page=1e18 reached the wire as
// "20000000000000000000" and page=1e20 as "2e+21", and both answered 500.
export const MAX_PAGE = 1_000_000;

// A class so the global ValidationPipe converts page and perPage to numbers and
// rejects a malformed value or unknown key with a 400. As an interface these
// reached the query as raw strings: perPage=0 divided into total_pages:
// Infinity, which JSON writes as null against a declared number, and page=0
// sent Postgres a negative OFFSET (issue #331).
export class ListArticlesRequestDto
  implements Omit<ArticleFilter, 'archiveScope'>, Partial<ArticlePage>
{
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PER_PAGE)
  perPage?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  direction?: string;

  @IsOptional()
  @IsString()
  feedProfile?: string;

  @IsOptional()
  @IsString()
  feedSource?: string;

  @IsOptional()
  @IsString()
  searchTerm?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  preset?: string;

  @IsOptional()
  @IsString()
  category?: string;

  // Bound separately by name and resolved through parseArchiveScope, declared
  // here only so whitelist validation does not reject the parameter.
  @IsOptional()
  @IsString()
  archive_scope?: string;
}

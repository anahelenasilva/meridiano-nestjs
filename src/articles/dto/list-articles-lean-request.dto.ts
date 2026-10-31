import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { ListArticlesLeanRequest } from '../queries/list-articles-lean.query';
import { MAX_PAGE, MAX_PER_PAGE } from './list-articles-request.dto';

// A class for the same reason as ListArticlesRequestDto: the lean listing read
// its pagination off the query string unvalidated too (issue #331).
export class ListArticlesLeanRequestDto implements ListArticlesLeanRequest {
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
  feedProfile?: string;

  @IsOptional()
  @IsString()
  feedSource?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

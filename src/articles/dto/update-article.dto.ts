import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxDate,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { FeedProfile } from '../../shared/types/feed';
import { ArticleCategory } from '../article.entity';

const TITLE_MAX_LENGTH = 500;
const FEED_SOURCE_MAX_LENGTH = 255;

/**
 * Partial-update contract for Article metadata. Every field is optional, but the
 * NOT-NULL columns cannot be blanked: `@ValidateIf(value !== undefined)` runs the
 * validators for an explicitly-sent null/empty value (yielding 400) while leaving
 * an *omitted* key untouched. `@IsOptional` would treat null as "skip" and let a
 * caller silently blank a required field, so it is deliberately not used here.
 */
export class UpdateArticleDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Type(() => Date)
  @IsDate({ message: 'publishedDate must be a valid date' })
  @MaxDate(() => new Date(), {
    message: 'publishedDate cannot be in the future',
  })
  publishedDate?: Date;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(FEED_SOURCE_MAX_LENGTH)
  feedSource?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(FeedProfile, { message: 'Invalid feed profile' })
  feedProfile?: FeedProfile;

  // Two-state: a non-empty list or `[]`. Both persist as non-null; there is no
  // null-reset path. De-duplication happens in the service, so duplicates are
  // accepted rather than rejected here.
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsEnum(ArticleCategory, {
    each: true,
    message: 'Invalid category',
  })
  categories?: ArticleCategory[];
}

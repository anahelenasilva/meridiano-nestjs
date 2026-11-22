import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const FEEDBACK_MESSAGE_MAX_LENGTH = 5000;
export const FEEDBACK_PAGE_CONTEXT_MAX_LENGTH = 500;

export class CreateFeedbackDto {
  @ApiProperty({ maxLength: FEEDBACK_MESSAGE_MAX_LENGTH })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(FEEDBACK_MESSAGE_MAX_LENGTH)
  message: string;

  // Single line only: the issue body renders it as an inline code span, and a
  // line break would let it escape into markdown.
  @ApiPropertyOptional({
    maxLength: FEEDBACK_PAGE_CONTEXT_MAX_LENGTH,
    description:
      'Where the user was when they wrote the feedback, such as the route',
    example: '/articles/123',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_PAGE_CONTEXT_MAX_LENGTH)
  @Matches(/^[^\r\n]*$/, { message: 'pageContext must be a single line' })
  pageContext?: string;
}

export class FeedbackResponseDto {
  @ApiProperty({ example: 412 })
  issueNumber: number;

  @ApiProperty({
    example: 'https://github.com/owner/repo/issues/412',
  })
  issueUrl: string;
}

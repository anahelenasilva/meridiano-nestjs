import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const FEEDBACK_MESSAGE_MAX_LENGTH = 5000;

export class CreateFeedbackDto {
  @ApiProperty({ maxLength: FEEDBACK_MESSAGE_MAX_LENGTH })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(FEEDBACK_MESSAGE_MAX_LENGTH)
  message: string;
}

export class FeedbackResponseDto {
  @ApiProperty({ example: 412 })
  issueNumber: number;

  @ApiProperty({
    example: 'https://github.com/owner/repo/issues/412',
  })
  issueUrl: string;
}

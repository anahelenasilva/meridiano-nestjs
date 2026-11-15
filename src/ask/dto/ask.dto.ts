import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const ASK_SOURCE_TYPES = ['article', 'transcription'] as const;
export type AskSourceType = (typeof ASK_SOURCE_TYPES)[number];

export const MAX_ASK_QUESTION_LENGTH = 2000;
export const MAX_ASK_ANSWER_LENGTH = 20000;
export const MAX_ASK_HISTORY_TURNS = 20;

const NOT_BLANK = /\S/;

export class AskTurnDto {
  @IsString({ message: 'history question must be a string' })
  @MaxLength(MAX_ASK_QUESTION_LENGTH, {
    message: `history question must not exceed ${MAX_ASK_QUESTION_LENGTH} characters`,
  })
  question: string;

  @IsString({ message: 'history answer must be a string' })
  @MaxLength(MAX_ASK_ANSWER_LENGTH, {
    message: `history answer must not exceed ${MAX_ASK_ANSWER_LENGTH} characters`,
  })
  answer: string;
}

export class AskRequestDto {
  @IsIn(ASK_SOURCE_TYPES, {
    message: `source_type must be one of: ${ASK_SOURCE_TYPES.join(', ')}`,
  })
  source_type: AskSourceType;

  @IsUUID('4', { message: 'source_id must be a valid UUID' })
  source_id: string;

  @IsString({ message: 'question must be a string' })
  @Matches(NOT_BLANK, { message: 'question must not be empty' })
  @MaxLength(MAX_ASK_QUESTION_LENGTH, {
    message: `question must not exceed ${MAX_ASK_QUESTION_LENGTH} characters`,
  })
  question: string;

  /** Earlier turns of the same Ask, oldest first. The server keeps no state. */
  @IsOptional()
  @IsArray({ message: 'history must be an array' })
  @ArrayMaxSize(MAX_ASK_HISTORY_TURNS, {
    message: `history must not exceed ${MAX_ASK_HISTORY_TURNS} turns`,
  })
  @ValidateNested({ each: true })
  @Type(() => AskTurnDto)
  history?: AskTurnDto[];
}

export class AskResponseDto {
  /** Markdown. */
  answer: string;
  /** The chat model id that answered, `deepseek` or `openai`. */
  model: string;
  /** True when the source text was cut to fit the model's input. */
  truncated: boolean;
}

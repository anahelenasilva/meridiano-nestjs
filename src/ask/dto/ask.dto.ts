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
import {
  CHAT_MODEL_IDS,
  type ValidChatModel,
} from '../../config/config.entity';
import {
  NOTE_SOURCE_TYPES,
  type NoteSourceType,
} from '../../notes/note.entity';

export const MAX_ASK_QUESTION_LENGTH = 2000;
export const MAX_ASK_ANSWER_LENGTH = 20000;

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
  @IsIn(NOTE_SOURCE_TYPES, {
    message: `source_type must be one of: ${NOTE_SOURCE_TYPES.join(', ')}`,
  })
  source_type: NoteSourceType;

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
  // A literal, not a constant: the swagger plugin only copies a literal into maxItems.
  @ArrayMaxSize(20, {
    message: 'history must not exceed 20 turns',
  })
  @ValidateNested({ each: true })
  @Type(() => AskTurnDto)
  history?: AskTurnDto[];

  /** One of the ids from `GET /api/ask/models`. Defaults to the configured chat model. */
  @IsOptional()
  @IsIn(CHAT_MODEL_IDS, {
    message: `model must be one of: ${CHAT_MODEL_IDS.join(', ')}`,
  })
  model?: ValidChatModel;
}

export class AskResponseDto {
  /** Markdown. */
  answer: string;
  model: ValidChatModel;
  /** True when the source text was cut to fit the model's input. */
  truncated: boolean;
}

export class AskModelDto {
  id: ValidChatModel;
  label: string;
  /** The provider's model string, such as `deepseek-flash`. */
  model_name: string;
  /** True for the configured chat model, which answers when `model` is omitted. */
  is_default: boolean;
}

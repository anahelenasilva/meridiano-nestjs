import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const DISPOSITIONS = [
  'reference_only',
  'connect_to_note',
  'experiment',
  'task',
  'verify_claim',
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export const ACTION_STATUSES = [
  'reference',
  'proposed',
  'dismissed',
  'executing',
  'executed',
  'failed',
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const TRANSITION_TARGETS = [
  'dismissed',
  'executing',
  'executed',
  'failed',
] as const satisfies readonly ActionStatus[];
export type TransitionTarget = (typeof TRANSITION_TARGETS)[number];

export interface ActionProposal {
  title: string;
  details: string;
  definition_of_done: string | null;
  source_claim: string | null;
  timebox_minutes: number | null;
  success_signal: string | null;
  target: string | null;
  wiki_bullet: string | null;
}

export interface ArticleAction {
  id: string;
  article_id: string;
  short_id: string;
  title: string;
  url: string;
  disposition: Disposition;
  confidence: number;
  rationale: string;
  proposal: ActionProposal | null;
  status: ActionStatus;
  downgraded_from: Disposition | null;
  external_ref: string | null;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PendingArticle {
  id: string;
  title: string;
  url: string;
  processed_content: string;
}

// `proposal` is JSONB, which pg parses into an object, and `title`/`url` come
// from the joined `articles` row.
export type ArticleActionRow = Omit<
  ArticleAction,
  'short_id' | 'created_at' | 'updated_at'
> & {
  created_at: string;
  updated_at: string;
};

export const SHORT_ID_PATTERN = /^[0-9a-f]{8}$/;

export function mapRowToArticleAction(row: ArticleActionRow): ArticleAction {
  return {
    ...row,
    short_id: row.article_id.slice(0, 8),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export class ActionProposalDto implements ActionProposal {
  @IsString()
  title: string;

  @IsString()
  @MaxLength(1500)
  details: string;

  @IsOptional()
  @IsString()
  definition_of_done: string | null;

  @IsOptional()
  @IsString()
  source_claim: string | null;

  @IsOptional()
  @IsInt()
  timebox_minutes: number | null;

  @IsOptional()
  @IsString()
  success_signal: string | null;

  @IsOptional()
  @IsString()
  target: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  wiki_bullet: string | null;
}

export class SaveArticleActionDto {
  @IsUUID('all', { message: 'article_id must be a valid UUID' })
  article_id: string;

  @IsIn(DISPOSITIONS, {
    message: `disposition must be one of: ${DISPOSITIONS.join(', ')}`,
  })
  disposition: Disposition;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsString()
  @MaxLength(1000)
  rationale: string;

  // Null for reference_only. Omitting it counts as null.
  @IsOptional()
  @ValidateNested()
  @Type(() => ActionProposalDto)
  proposal?: ActionProposalDto | null;
}

export class TransitionArticleActionDto {
  @IsIn(TRANSITION_TARGETS, {
    message: `status must be one of: ${TRANSITION_TARGETS.join(', ')}`,
  })
  status: TransitionTarget;

  // The Notion page id or wiki commit the executor produced.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  external_ref?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  error?: string;
}

export class PendingArticleQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'since must be YYYY-MM-DD' })
  since: string;
}

export class ArticleActionResponseDto {
  action: ArticleAction;

  constructor(action: ArticleAction) {
    this.action = action;
  }
}

export class PendingArticleResponseDto {
  article: PendingArticle | null;

  constructor(article: PendingArticle | null) {
    this.article = article;
  }
}

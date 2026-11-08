import {
  DatabaseService,
  queryAll,
  queryOne,
  type SqlParams,
} from '@libs/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { startOfMeridianoDay } from '../shared/helpers/meridiano-day';
import {
  ActionProposal,
  ActionStatus,
  ArticleAction,
  ArticleActionRow,
  Disposition,
  mapRowToArticleAction,
  PendingArticle,
  SaveArticleActionDto,
  TransitionArticleActionDto,
  TransitionTarget,
} from './article-action.entity';

const MIN_CONFIDENCE = 0.7;
const VAGUE_TASK_TITLE = /^\s*(read|look into|check out)\b/i;
// index.md and log.md are maintained by the wiki's own tooling, and `..` would
// let a proposal write outside wiki/.
const WIKI_TARGET = /^wiki\/(?!index\.md$|log\.md$)(?!.*\.\.).+\.md$/;

const ACTION_COLUMNS = `
  aa.id, aa.article_id, a.title, a.url, aa.disposition, aa.confidence,
  aa.rationale, aa.proposal, aa.status, aa.downgraded_from, aa.external_ref,
  aa.error, aa.created_at, aa.updated_at
`;

// Wraps an INSERT or UPDATE ... RETURNING * so the write and the article join
// happen in one statement.
function returningAction(writeSql: string): string {
  return `
    WITH saved AS (${writeSql} RETURNING *)
    SELECT ${ACTION_COLUMNS}
    FROM saved aa
    JOIN articles a ON a.id = aa.article_id
  `;
}

// Each target lists the statuses one UPDATE may move it from, so two callers
// racing on the same row cannot both win. A stale `executing` row is a crashed
// run, which the next executor may reclaim.
const TRANSITION_FROM: Record<TransitionTarget, string> = {
  dismissed: `status IN ('proposed', 'failed', 'dismissed')`,
  executing: `(status IN ('proposed', 'failed') OR (status = 'executing' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'))`,
  executed: `status = 'executing'`,
  failed: `status = 'executing'`,
};

interface ClassifiedAction {
  disposition: Disposition;
  status: Extract<ActionStatus, 'reference' | 'proposed'>;
  proposal: ActionProposal | null;
  downgraded_from: Disposition | null;
}

interface PgError {
  code?: string;
}

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim().length === 0;
}

function requireField(
  disposition: Disposition,
  field: keyof ActionProposal,
  value: string | null,
): void {
  if (isBlank(value)) {
    throw new BadRequestException(`${disposition} requires proposal.${field}`);
  }
}

// The structured outcome contract from the article-to-action spec. A low
// confidence call falls back to reference_only, except verify_claim, where
// doubt is the reason to propose it.
function classify(input: SaveArticleActionDto): ClassifiedAction {
  const { disposition } = input;

  if (disposition === 'reference_only') {
    if (input.proposal !== null && input.proposal !== undefined) {
      throw new BadRequestException('reference_only requires a null proposal');
    }
    return {
      disposition,
      status: 'reference',
      proposal: null,
      downgraded_from: null,
    };
  }

  if (input.confidence < MIN_CONFIDENCE && disposition !== 'verify_claim') {
    return {
      disposition: 'reference_only',
      status: 'reference',
      proposal: null,
      downgraded_from: disposition,
    };
  }

  if (input.proposal === null || input.proposal === undefined) {
    throw new BadRequestException(`${disposition} requires a proposal`);
  }
  // Omitted optional fields arrive as undefined; store them as null so every
  // reader of the JSONB sees the full ActionProposal shape.
  const proposal: ActionProposal = {
    title: input.proposal.title,
    details: input.proposal.details,
    definition_of_done: input.proposal.definition_of_done ?? null,
    source_claim: input.proposal.source_claim ?? null,
    timebox_minutes: input.proposal.timebox_minutes ?? null,
    success_signal: input.proposal.success_signal ?? null,
    target: input.proposal.target ?? null,
    wiki_bullet: input.proposal.wiki_bullet ?? null,
  };
  requireField(disposition, 'title', proposal.title);

  switch (disposition) {
    case 'task':
      requireField(
        disposition,
        'definition_of_done',
        proposal.definition_of_done,
      );
      if (VAGUE_TASK_TITLE.test(proposal.title)) {
        throw new BadRequestException(
          'task title must not start with "read", "look into" or "check out"',
        );
      }
      break;
    case 'experiment':
      if (!proposal.timebox_minutes || proposal.timebox_minutes <= 0) {
        throw new BadRequestException(
          'experiment requires proposal.timebox_minutes greater than 0',
        );
      }
      requireField(disposition, 'success_signal', proposal.success_signal);
      break;
    case 'verify_claim':
      requireField(disposition, 'source_claim', proposal.source_claim);
      break;
    case 'connect_to_note':
      if (!proposal.target || !WIKI_TARGET.test(proposal.target)) {
        throw new BadRequestException(
          'connect_to_note requires proposal.target as wiki/<page>.md, not wiki/index.md or wiki/log.md',
        );
      }
      requireField(disposition, 'wiki_bullet', proposal.wiki_bullet);
      break;
  }

  return { disposition, status: 'proposed', proposal, downgraded_from: null };
}

@Injectable()
export class ArticleActionsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * The oldest processed Manual article created on or after the Meridiano Day
   * `since` that has no action yet. Hermes polls this, so an article a run
   * missed comes back on the next one.
   */
  async findPending(since: string): Promise<PendingArticle | null> {
    let start: Date;
    try {
      start = startOfMeridianoDay(since);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const row = await queryOne<PendingArticle>(
      this.databaseService.getDbConnection(),
      `
        SELECT a.id, a.title, a.url, a.processed_content
        FROM articles a
        LEFT JOIN article_actions aa ON aa.article_id = a.id
        WHERE a.feed_source = 'Manual'
          AND a.processed_content IS NOT NULL
          AND a.created_at >= ?
          AND aa.id IS NULL
        ORDER BY a.created_at ASC
        LIMIT 1
      `,
      [start.toISOString()],
    );
    return row ?? null;
  }

  async create(input: SaveArticleActionDto): Promise<ArticleAction> {
    try {
      return await this.save(
        `
          INSERT INTO article_actions
            (disposition, confidence, rationale, proposal, status, downgraded_from, article_id)
          VALUES (?, ?, ?, ?::jsonb, ?, ?, ?)
        `,
        input,
        () =>
          new Error(
            `article_actions insert for article ${input.article_id} returned no row`,
          ),
      );
    } catch (error) {
      const { code } = error as PgError;
      if (code === '23505') {
        throw new ConflictException(
          `Article ${input.article_id} already has an action`,
        );
      }
      if (code === '23503') {
        throw new NotFoundException(`Article ${input.article_id} not found`);
      }
      throw error;
    }
  }

  /** Replaces a proposal Ana asked to change before she approves it. */
  async revise(
    shortId: string,
    input: SaveArticleActionDto,
  ): Promise<ArticleAction> {
    const current = await this.getByShortId(shortId);
    if (current.article_id !== input.article_id) {
      throw new BadRequestException(
        `Action ${shortId} belongs to article ${current.article_id}, not ${input.article_id}`,
      );
    }
    if (current.status !== 'proposed') {
      throw new ConflictException(
        `Action ${shortId} is ${current.status}; only a proposed action can be revised`,
      );
    }

    return this.save(
      `
        UPDATE article_actions
        SET disposition = ?, confidence = ?, rationale = ?, proposal = ?::jsonb,
            status = ?, downgraded_from = ?, updated_at = CURRENT_TIMESTAMP
        WHERE article_id = ? AND status = 'proposed'
      `,
      input,
      () =>
        new ConflictException(
          `Action ${shortId} changed status while it was being revised`,
        ),
    );
  }

  // `writeSql` takes the classified fields in this order, article_id last so
  // an UPDATE can match on it. `noRowError` is what a write that touched no
  // row means to the caller.
  private async save(
    writeSql: string,
    input: SaveArticleActionDto,
    noRowError: () => Error,
  ): Promise<ArticleAction> {
    const action = classify(input);
    const row = await queryOne<ArticleActionRow>(
      this.databaseService.getDbConnection(),
      returningAction(writeSql),
      [
        action.disposition,
        input.confidence,
        input.rationale,
        action.proposal && JSON.stringify(action.proposal),
        action.status,
        action.downgraded_from,
        input.article_id,
      ],
    );
    if (!row) {
      throw noRowError();
    }
    return mapRowToArticleAction(row);
  }

  /** Resolves the short id Ana types in Discord: the article id's first 8 hex chars. */
  async getByShortId(shortId: string): Promise<ArticleAction> {
    const rows = await queryAll<ArticleActionRow>(
      this.databaseService.getDbConnection(),
      `
        SELECT ${ACTION_COLUMNS}
        FROM article_actions aa
        JOIN articles a ON a.id = aa.article_id
        WHERE LEFT(aa.article_id::text, 8) = ?
        LIMIT 2
      `,
      [shortId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`No article action with short id ${shortId}`);
    }
    if (rows.length > 1) {
      throw new ConflictException(
        `Short id ${shortId} matches more than one article action`,
      );
    }
    return mapRowToArticleAction(rows[0]);
  }

  async transition(
    shortId: string,
    input: TransitionArticleActionDto,
  ): Promise<ArticleAction> {
    if (input.status === 'executed' && isBlank(input.external_ref)) {
      throw new BadRequestException('executed requires external_ref');
    }
    if (input.status === 'failed' && isBlank(input.error)) {
      throw new BadRequestException('failed requires error');
    }

    const current = await this.getByShortId(shortId);
    // Repeating a finished transition is a retry, not a conflict.
    if (
      current.status === input.status &&
      (input.status === 'dismissed' || input.status === 'executed')
    ) {
      return current;
    }

    const [assignments, params]: [string, SqlParams] =
      input.status === 'executed'
        ? [', external_ref = ?, error = NULL', [input.external_ref]]
        : input.status === 'failed'
          ? [', error = ?', [input.error]]
          : ['', []];

    const row = await queryOne<ArticleActionRow>(
      this.databaseService.getDbConnection(),
      returningAction(`
        UPDATE article_actions
        SET status = ?${assignments}, updated_at = CURRENT_TIMESTAMP
        WHERE article_id = ? AND ${TRANSITION_FROM[input.status]}
      `),
      [input.status, ...params, current.article_id],
    );
    if (!row) {
      throw new ConflictException(
        `Action ${shortId} is ${current.status} and cannot move to ${input.status}`,
      );
    }
    return mapRowToArticleAction(row);
  }
}

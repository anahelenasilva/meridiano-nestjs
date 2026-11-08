import { DatabaseService } from '@libs/database';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import {
  ActionProposalDto,
  ArticleActionRow,
  SaveArticleActionDto,
} from './article-action.entity';
import { ArticleActionsService } from './article-actions.service';

const ARTICLE_ID = 'a22a8280-1111-4111-8111-111111111111';

function actionRow(
  overrides: Partial<ArticleActionRow> = {},
): ArticleActionRow {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    article_id: ARTICLE_ID,
    title: 'How MCP servers work',
    url: 'https://example.com/mcp',
    disposition: 'task',
    confidence: 0.85,
    rationale: 'Concrete setup steps Ana can follow',
    proposal: null,
    status: 'proposed',
    downgraded_from: null,
    external_ref: null,
    error: null,
    created_at: '2026-11-08T12:00:00.000Z',
    updated_at: '2026-11-08T12:00:00.000Z',
    ...overrides,
  };
}

function proposal(
  overrides: Partial<ActionProposalDto> = {},
): ActionProposalDto {
  return {
    title: 'Set up an MCP server for the wiki',
    details: 'Follow the article setup section',
    definition_of_done: 'The wiki MCP server answers a search',
    source_claim: null,
    timebox_minutes: null,
    success_signal: null,
    target: null,
    wiki_bullet: null,
    ...overrides,
  };
}

function saveInput(
  overrides: Partial<SaveArticleActionDto> = {},
): SaveArticleActionDto {
  return {
    article_id: ARTICLE_ID,
    disposition: 'task',
    confidence: 0.85,
    rationale: 'Concrete setup steps Ana can follow',
    proposal: proposal(),
    ...overrides,
  };
}

function pgError(code: string): Error {
  return Object.assign(new Error(`pg error ${code}`), { code });
}

describe('ArticleActionsService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    get: jest.fn(),
    all: jest.fn(),
  };

  let service: ArticleActionsService;

  function nextGet(row: unknown, err: Error | null = null) {
    mockDb.get.mockImplementationOnce((sql, params, callback) => {
      callback(err, row);
    });
  }

  function nextAll(rows: unknown[]) {
    mockDb.all.mockImplementationOnce((sql, params, callback) => {
      callback(null, rows);
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new ArticleActionsService(mockDatabaseService);
  });

  it('findPending returns the oldest unclassified processed Manual article since the cutover', async () => {
    const pending = {
      id: ARTICLE_ID,
      title: 'How MCP servers work',
      url: 'https://example.com/mcp',
      processed_content: 'Summary',
    };
    nextGet(pending);

    const result = await service.findPending('2026-11-07');

    expect(result).toEqual(pending);
    const [sql, params] = mockDb.get.mock.calls[0];
    expect(sql).toContain('LEFT JOIN article_actions');
    expect(sql).toContain("a.feed_source = 'Manual'");
    expect(sql).toContain('a.processed_content IS NOT NULL');
    expect(sql).toContain('aa.id IS NULL');
    expect(sql).toContain('ORDER BY a.created_at ASC');
    // Midnight in Sao Paulo, as the UTC wall clock articles.created_at holds.
    expect(params).toEqual(['2026-11-07T03:00:00.000Z']);
  });

  it('create saves reference_only as status reference with a null proposal', async () => {
    nextGet(actionRow({ disposition: 'reference_only', status: 'reference' }));

    const result = await service.create(
      saveInput({ disposition: 'reference_only', proposal: null }),
    );

    expect(result.status).toBe('reference');
    expect(result.short_id).toBe('a22a8280');
    expect(mockDb.get.mock.calls[0][1]).toEqual([
      ARTICLE_ID,
      'reference_only',
      0.85,
      'Concrete setup steps Ana can follow',
      null,
      'reference',
      null,
    ]);
  });

  it('create downgrades a 0.6 task to reference and records downgraded_from = task', async () => {
    nextGet(
      actionRow({
        disposition: 'reference_only',
        status: 'reference',
        downgraded_from: 'task',
      }),
    );

    await service.create(saveInput({ confidence: 0.6 }));

    expect(mockDb.get.mock.calls[0][1]).toEqual([
      ARTICLE_ID,
      'reference_only',
      0.6,
      'Concrete setup steps Ana can follow',
      null,
      'reference',
      'task',
    ]);
  });

  it('create keeps a 0.6 verify_claim as proposed', async () => {
    const claim = proposal({
      title: 'Verify the 40% latency claim',
      definition_of_done: null,
      source_claim: 'MCP cuts latency by 40%',
    });
    nextGet(actionRow({ disposition: 'verify_claim', proposal: claim }));

    await service.create(
      saveInput({
        disposition: 'verify_claim',
        confidence: 0.6,
        proposal: claim,
      }),
    );

    const params = mockDb.get.mock.calls[0][1];
    expect(params[1]).toBe('verify_claim');
    expect(JSON.parse(params[4])).toEqual(claim);
    expect(params[5]).toBe('proposed');
  });

  it('create rejects a task titled "Read more about MCP"', async () => {
    await expect(
      service.create(
        saveInput({ proposal: proposal({ title: 'Read more about MCP' }) }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockDb.get).not.toHaveBeenCalled();
  });

  it('create rejects connect_to_note targeting wiki/log.md', async () => {
    await expect(
      service.create(
        saveInput({
          disposition: 'connect_to_note',
          proposal: proposal({
            definition_of_done: null,
            target: 'wiki/log.md',
            wiki_bullet: '- Source: How MCP servers work',
          }),
        }),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockDb.get).not.toHaveBeenCalled();
  });

  it('create returns 409 when the article already has an action', async () => {
    nextGet(undefined, pgError('23505'));

    await expect(service.create(saveInput())).rejects.toThrow(
      ConflictException,
    );
  });

  it('create returns 404 when the article does not exist', async () => {
    nextGet(undefined, pgError('23503'));

    await expect(service.create(saveInput())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getByShortId returns 409 when two article ids share the first 8 hex chars', async () => {
    nextAll([
      actionRow(),
      actionRow({ article_id: 'a22a8280-2222-4222-8222-222222222222' }),
    ]);

    await expect(service.getByShortId('a22a8280')).rejects.toThrow(
      ConflictException,
    );
  });

  it('revise returns 409 unless the action is proposed', async () => {
    nextAll([actionRow({ status: 'executed', external_ref: 'notion-page' })]);

    await expect(service.revise('a22a8280', saveInput())).rejects.toThrow(
      ConflictException,
    );
    expect(mockDb.get).not.toHaveBeenCalled();
  });

  it('transition to executed without external_ref is rejected', async () => {
    await expect(
      service.transition('a22a8280', { status: 'executed' }),
    ).rejects.toThrow(BadRequestException);
    expect(mockDb.all).not.toHaveBeenCalled();
  });

  it('transition to executing from executed returns 409', async () => {
    nextAll([actionRow({ status: 'executed', external_ref: 'notion-page' })]);
    nextGet(undefined);

    await expect(
      service.transition('a22a8280', { status: 'executing' }),
    ).rejects.toThrow(ConflictException);
  });

  it('reclaims a stale executing row older than 10 minutes', async () => {
    nextAll([actionRow({ status: 'executing' })]);
    nextGet(
      actionRow({
        status: 'executing',
        updated_at: '2026-11-08T12:30:00.000Z',
      }),
    );

    const result = await service.transition('a22a8280', {
      status: 'executing',
    });

    expect(result.updated_at).toEqual(new Date('2026-11-08T12:30:00.000Z'));
    const [sql, params] = mockDb.get.mock.calls[0];
    expect(sql).toContain(
      "status = 'executing' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes'",
    );
    expect(params).toEqual(['executing', ARTICLE_ID]);
  });

  it('transition to dismissed twice returns the same row', async () => {
    const dismissed = actionRow({
      status: 'dismissed',
      updated_at: '2026-11-08T13:00:00.000Z',
    });
    nextAll([actionRow()]);
    nextGet(dismissed);
    nextAll([dismissed]);

    const first = await service.transition('a22a8280', { status: 'dismissed' });
    const second = await service.transition('a22a8280', {
      status: 'dismissed',
    });

    expect(second).toEqual(first);
    expect(mockDb.get).toHaveBeenCalledTimes(1);
  });
});

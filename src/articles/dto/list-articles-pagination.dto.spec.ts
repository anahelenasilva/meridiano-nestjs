/**
 * The page/perPage contract of both article listing DTOs (issue #331).
 *
 * plainToInstance plus validate is what the global ValidationPipe
 * (`src/main.ts:17-21`) does to a query string, so these cover the coercion and
 * the bounds under `pnpm test`, which CI runs. The HTTP-level proof lives in
 * `test/articles-pagination.e2e-spec.ts`, which CI does not run.
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListArticlesLeanRequestDto } from './list-articles-lean-request.dto';
import {
  ListArticlesRequestDto,
  MAX_PAGE,
  MAX_PER_PAGE,
} from './list-articles-request.dto';

type PaginationDto = ListArticlesRequestDto | ListArticlesLeanRequestDto;

const DTOS: [string, new () => PaginationDto][] = [
  ['ListArticlesRequestDto', ListArticlesRequestDto],
  ['ListArticlesLeanRequestDto', ListArticlesLeanRequestDto],
];

// Mirrors how the pipe is constructed in src/main.ts.
const validateQuery = (
  dto: new () => PaginationDto,
  query: Record<string, string>,
) =>
  validate(plainToInstance(dto, query), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe.each(DTOS)('%s pagination', (_name, dto) => {
  it('coerces page and perPage from the query string to numbers', async () => {
    const instance = plainToInstance(dto, { page: '2', perPage: '10' });

    expect(await validate(instance)).toHaveLength(0);
    expect(instance.page).toBe(2);
    expect(instance.perPage).toBe(10);
  });

  it('accepts an absent page and perPage so the query defaults apply', async () => {
    const instance = plainToInstance(dto, {});

    expect(await validate(instance)).toHaveLength(0);
    expect(instance.page).toBeUndefined();
    expect(instance.perPage).toBeUndefined();
  });

  it.each([
    [`page at the ${MAX_PAGE} cap`, { page: String(MAX_PAGE) }],
    [`perPage at the ${MAX_PER_PAGE} cap`, { perPage: String(MAX_PER_PAGE) }],
  ])('accepts %s', async (_label, query) => {
    expect(await validateQuery(dto, query)).toHaveLength(0);
  });

  it.each([
    ['page=0, which makes OFFSET negative', { page: '0' }, 'page'],
    ['a negative page', { page: '-5' }, 'page'],
    ['a fractional page', { page: '1.5' }, 'page'],
    ['a non-numeric page', { page: 'abc' }, 'page'],
    ['page past the cap, which overflows OFFSET', { page: '1000001' }, 'page'],
    [
      'page as 1e18, which exceeds bigint on the wire',
      { page: '1e18' },
      'page',
    ],
    [
      'page as 1e20, which reaches the wire as "2e+21"',
      { page: '1e20' },
      'page',
    ],
    [
      'perPage=0, which divides total_pages into Infinity',
      { perPage: '0' },
      'perPage',
    ],
    [
      'a non-numeric perPage, which would reach LIMIT',
      { perPage: 'abc' },
      'perPage',
    ],
    ['perPage above the cap', { perPage: '101' }, 'perPage'],
  ])('rejects %s', async (_label, query, property) => {
    const errors = await validateQuery(dto, query);

    expect(errors.map((error) => error.property)).toEqual([property]);
  });

  it('rejects an unknown query key', async () => {
    const errors = await validateQuery(dto, { pge: '2' });

    expect(errors.map((error) => error.property)).toEqual(['pge']);
  });
});

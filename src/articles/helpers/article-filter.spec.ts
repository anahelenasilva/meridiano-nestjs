import { compileArticleFilter } from './article-filter';

// SQL behavior of each filter field runs against real Postgres in
// test/article-filter.e2e-spec.ts. This spec pins the preset date math, which
// depends on the local time zone (jest-global-setup pins one west of UTC).
describe('compileArticleFilter preset windows', () => {
  const now = new Date(2024, 4, 31, 22, 30);

  it.each([
    ['yesterday', '2024-05-30', '2024-05-30'],
    ['last_week', '2024-05-24', '2024-05-31'],
    ['last_30d', '2024-05-01', '2024-05-31'],
    ['last_3m', '2024-02-29', '2024-05-31'],
    ['last_12m', '2023-05-31', '2024-05-31'],
  ])('resolves %s to %s through %s in local time', (preset, start, end) => {
    const { params } = compileArticleFilter({ preset }, now);

    expect(params).toEqual([start, end]);
  });

  it('replaces explicit dates with a known preset window', () => {
    const { params } = compileArticleFilter(
      { preset: 'yesterday', startDate: '2020-01-01', endDate: '2020-12-31' },
      now,
    );

    expect(params).toEqual(['2024-05-30', '2024-05-30']);
  });

  it('keeps the explicit dates for an unknown preset', () => {
    const { params } = compileArticleFilter(
      { preset: 'bogus', startDate: '2024-01-01', endDate: '2024-01-31' },
      now,
    );

    expect(params).toEqual(['2024-01-01', '2024-01-31']);
  });
});

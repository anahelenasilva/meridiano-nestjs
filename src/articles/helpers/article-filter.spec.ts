import { compileArticleFilter } from './article-filter';

// SQL behavior of each filter field runs against real Postgres in
// test/article-filter.e2e-spec.ts. This spec pins the date math: which
// Meridiano Day a preset lands on, and the instants that day compiles to.
describe('compileArticleFilter preset windows', () => {
  // 22:00 on 2026-10-25 in Sao Paulo, already 2026-10-26 in UTC.
  const lateEvening = new Date('2026-10-26T01:00:00Z');

  it.each([
    ['yesterday', '2026-10-24T03:00:00.000Z', '2026-10-25T03:00:00.000Z'],
    ['last_week', '2026-10-18T03:00:00.000Z', '2026-10-26T03:00:00.000Z'],
    ['last_30d', '2026-09-25T03:00:00.000Z', '2026-10-26T03:00:00.000Z'],
    ['last_3m', '2026-07-25T03:00:00.000Z', '2026-10-26T03:00:00.000Z'],
    ['last_12m', '2025-10-25T03:00:00.000Z', '2026-10-26T03:00:00.000Z'],
  ])('resolves %s to the Meridiano Days %s through %s', (preset, start, end) => {
    const { params } = compileArticleFilter({ preset }, lateEvening);

    expect(params).toEqual([start, end]);
  });

  it('bounds the window half-open, so the whole end day is inside it', () => {
    const { where } = compileArticleFilter({ preset: 'yesterday' }, lateEvening);

    expect(where).toBe(
      'archived_at IS NULL AND published_date >= ? AND published_date < ?',
    );
  });

  it('replaces explicit dates with a known preset window', () => {
    const { params } = compileArticleFilter(
      { preset: 'yesterday', startDate: '2020-01-01', endDate: '2020-12-31' },
      lateEvening,
    );

    expect(params).toEqual([
      '2026-10-24T03:00:00.000Z',
      '2026-10-25T03:00:00.000Z',
    ]);
  });

  it('keeps the explicit dates for an unknown preset', () => {
    const { params } = compileArticleFilter(
      { preset: 'bogus', startDate: '2024-01-01', endDate: '2024-01-31' },
      lateEvening,
    );

    expect(params).toEqual([
      '2024-01-01T03:00:00.000Z',
      '2024-02-01T03:00:00.000Z',
    ]);
  });

  // jest-global-setup pins TZ to America/Sao_Paulo, the one zone where the old
  // host-local date math agreed with the digest. Issue #333 is the disagreement
  // off that zone, so the regression guard has to leave it.
  describe('with the host in another zone', () => {
    const hostTimeZone = process.env.TZ;

    beforeAll(() => {
      process.env.TZ = 'UTC';
    });

    afterAll(() => {
      process.env.TZ = hostTimeZone;
    });

    it('resolves yesterday to the reader day in Sao Paulo, not the host day', () => {
      const { params } = compileArticleFilter(
        { preset: 'yesterday' },
        lateEvening,
      );

      expect(params).toEqual([
        '2026-10-24T03:00:00.000Z',
        '2026-10-25T03:00:00.000Z',
      ]);
    });
  });
});

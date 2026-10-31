import {
  meridianoDate,
  startOfMeridianoDay,
  startOfNextMeridianoDay,
  subtractFromMeridianoDate,
} from './meridiano-day';

// 22:00 on 2026-10-25 in Sao Paulo, already 2026-10-26 in UTC: the instant
// from issue #333 where a UTC host and a BRT host disagreed on "yesterday".
const lateEvening = new Date('2026-10-26T01:00:00Z');

describe('meridianoDate', () => {
  it('resolves the Sao Paulo day of an instant that is already tomorrow in UTC', () => {
    expect(meridianoDate(lateEvening)).toBe('2026-10-25');
  });
});

describe('subtractFromMeridianoDate', () => {
  it.each([
    [1, 'days' as const, '2026-10-24'],
    [7, 'days' as const, '2026-10-18'],
    [1, 'weeks' as const, '2026-10-18'],
    [30, 'days' as const, '2026-09-25'],
  ])('walks back %s %s to %s', (amount, unit, expected) => {
    expect(subtractFromMeridianoDate(lateEvening, amount, unit)).toBe(expected);
  });

  it('clamps a month subtraction to the target month last day', () => {
    const endOfMay = new Date('2024-05-31T15:00:00Z');

    expect(subtractFromMeridianoDate(endOfMay, 3, 'months')).toBe('2024-02-29');
  });

  it('keeps the day of month when subtracting years', () => {
    const endOfMay = new Date('2024-05-31T15:00:00Z');

    expect(subtractFromMeridianoDate(endOfMay, 12, 'months')).toBe(
      '2023-05-31',
    );
  });
});

describe('startOfMeridianoDay', () => {
  it('is midnight in Sao Paulo, three hours behind UTC', () => {
    expect(startOfMeridianoDay('2026-10-25').toISOString()).toBe(
      '2026-10-25T03:00:00.000Z',
    );
  });

  it('follows the zone offset of the day, not a hardcoded one', () => {
    // 2018-12-01 fell inside Brazil's last summer time, at UTC-2.
    expect(startOfMeridianoDay('2018-12-01').toISOString()).toBe(
      '2018-12-01T02:00:00.000Z',
    );
  });

  it('starts a day whose midnight a clock jump skipped at the jump', () => {
    // Summer time began at midnight on 2018-11-04, so 00:00 never happened.
    const start = startOfMeridianoDay('2018-11-04');

    expect(start.toISOString()).toBe('2018-11-04T03:00:00.000Z');
    expect(meridianoDate(start)).toBe('2018-11-04');
  });

  it.each(['25/10/2026', '2026-10-25T00:00:00Z', '2026-02-30', ''])(
    'rejects %s, which is not a calendar date',
    (date) => {
      expect(() => startOfMeridianoDay(date)).toThrow(/YYYY-MM-DD/);
    },
  );
});

describe('startOfNextMeridianoDay', () => {
  it('is the start of the next day, so the whole day is inside the bound', () => {
    expect(startOfNextMeridianoDay('2026-10-25').toISOString()).toBe(
      '2026-10-26T03:00:00.000Z',
    );
  });

  it('crosses a month end', () => {
    expect(startOfNextMeridianoDay('2026-10-31').toISOString()).toBe(
      '2026-11-01T03:00:00.000Z',
    );
  });
});

// The rest of the suite runs under the zone jest-global-setup pins, which is
// the one zone where host-local date math happened to agree with the digest.
// These repeat the answers that matter with the host moved off it.
describe('with the host in another zone', () => {
  const hostTimeZone = process.env.TZ;

  beforeAll(() => {
    process.env.TZ = 'UTC';
  });

  afterAll(() => {
    process.env.TZ = hostTimeZone;
  });

  it('resolves the same Sao Paulo day', () => {
    expect(meridianoDate(lateEvening)).toBe('2026-10-25');
    expect(subtractFromMeridianoDate(lateEvening, 1, 'days')).toBe(
      '2026-10-24',
    );
  });

  it('resolves the same day bounds', () => {
    expect(startOfMeridianoDay('2026-10-25').toISOString()).toBe(
      '2026-10-25T03:00:00.000Z',
    );
    expect(startOfNextMeridianoDay('2026-10-25').toISOString()).toBe(
      '2026-10-26T03:00:00.000Z',
    );
  });
});

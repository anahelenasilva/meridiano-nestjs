import { subtractFromDate, toLocalDateString } from './date-math';

describe('subtractFromDate', () => {
  it.each([
    ['seconds', 30, '2024-05-31T11:59:30.000Z'],
    ['minutes', 15, '2024-05-31T11:45:00.000Z'],
    ['hours', 11, '2024-05-31T01:00:00.000Z'],
  ] as const)('subtracts %s as absolute time', (unit, amount, expected) => {
    const from = new Date('2024-05-31T12:00:00.000Z');

    expect(subtractFromDate(from, amount, unit).toISOString()).toBe(expected);
  });

  it('subtracts days on the local calendar, across a year boundary', () => {
    const from = new Date(2024, 0, 3, 9, 0);

    expect(subtractFromDate(from, 5, 'days')).toEqual(
      new Date(2023, 11, 29, 9, 0),
    );
  });

  it('subtracts weeks as seven calendar days each', () => {
    const from = new Date(2024, 2, 10, 9, 0);

    expect(subtractFromDate(from, 2, 'weeks')).toEqual(
      new Date(2024, 1, 25, 9, 0),
    );
  });

  it('clamps to the last day of a shorter target month', () => {
    const from = new Date(2024, 2, 31, 9, 0);

    expect(subtractFromDate(from, 1, 'months')).toEqual(
      new Date(2024, 1, 29, 9, 0),
    );
    expect(subtractFromDate(from, 13, 'months')).toEqual(
      new Date(2023, 1, 28, 9, 0),
    );
  });

  it('clamps Feb 29 to Feb 28 when subtracting into a non-leap year', () => {
    const from = new Date(2024, 1, 29, 9, 0);

    expect(subtractFromDate(from, 1, 'years')).toEqual(
      new Date(2023, 1, 28, 9, 0),
    );
  });

  it('does not mutate the input date', () => {
    const from = new Date(2024, 2, 31, 9, 0);
    const before = from.getTime();

    subtractFromDate(from, 3, 'months');
    subtractFromDate(from, 3, 'days');
    subtractFromDate(from, 3, 'hours');

    expect(from.getTime()).toBe(before);
  });
});

describe('toLocalDateString', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(toLocalDateString(new Date(2024, 0, 5, 9, 0))).toBe('2024-01-05');
  });

  it('uses the local date even when UTC has already rolled over', () => {
    expect(toLocalDateString(new Date(2024, 10, 15, 23, 30))).toBe(
      '2024-11-15',
    );
  });
});

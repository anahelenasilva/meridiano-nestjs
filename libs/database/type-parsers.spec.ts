import { types } from 'pg';
import { typeParsers } from './type-parsers';

describe('typeParsers', () => {
  const parseTimestamp = typeParsers.getTypeParser(
    types.builtins.TIMESTAMP,
    'text',
  );

  it('reads a TIMESTAMP as UTC wall time', () => {
    expect(parseTimestamp('2026-08-29 12:07:10.883')).toEqual(
      new Date('2026-08-29T12:07:10.883Z'),
    );
  });

  it('reads a TIMESTAMP without fractional seconds as UTC wall time', () => {
    expect(parseTimestamp('2026-03-20 00:00:00')).toEqual(
      new Date('2026-03-20T00:00:00.000Z'),
    );
  });

  it('leaves infinity to the node-pg parser', () => {
    expect(parseTimestamp('infinity')).toBe(Infinity);
    expect(parseTimestamp('-infinity')).toBe(-Infinity);
  });

  it('leaves TIMESTAMPTZ to the node-pg parser', () => {
    const parseTimestamptz = typeParsers.getTypeParser(
      types.builtins.TIMESTAMPTZ,
      'text',
    );

    expect(parseTimestamptz('2026-08-29 09:07:10.883-03')).toEqual(
      new Date('2026-08-29T12:07:10.883Z'),
    );
  });
});

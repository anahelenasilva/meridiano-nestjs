import { CustomTypesConfig, types } from 'pg';

type TypeParser<I, T> = (value: I) => T;

const timestampOid: number = types.builtins.TIMESTAMP;

const parseTimestampAsUtc = (value: string): Date =>
  new Date(`${value.replace(' ', 'T')}Z`);

function getTypeParser<T>(
  oid: number,
  format?: 'text',
): TypeParser<string, T | string>;
function getTypeParser<T>(
  oid: number,
  format: 'binary',
): TypeParser<Buffer, T | string>;
function getTypeParser(oid: number, format: 'text' | 'binary' = 'text') {
  if (format === 'binary') return types.getTypeParser(oid, 'binary');
  if (oid === timestampOid) return parseTimestampAsUtc;
  return types.getTypeParser(oid, 'text');
}

/**
 * Type parsers for the `pg` Pool. Every TIMESTAMP column stores UTC wall time
 * (writes pass `toISOString()`), so TIMESTAMP reads as UTC instead of in the
 * Node process's time zone.
 */
export const typeParsers: CustomTypesConfig = { getTypeParser };

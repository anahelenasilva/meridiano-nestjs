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
 * Type parsers for both `pg` pools, `DatabaseService`'s and TypeORM's. TIMESTAMP
 * columns store UTC wall time, from `toISOString()` or from `CURRENT_TIMESTAMP`
 * in a UTC session, so TIMESTAMP reads as UTC, not in the process's time zone.
 */
export const typeParsers: CustomTypesConfig = { getTypeParser };

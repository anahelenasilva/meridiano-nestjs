import { DatabaseConnection, SqlParams } from './database.interface';

// Promise wrappers over the callback-style DatabaseConnection. They take the
// connection instead of living on DatabaseService so service specs can keep
// faking getDbConnection() with plain all/get/run mocks.

export function queryAll<T = unknown>(
  db: DatabaseConnection,
  sql: string,
  params: SqlParams = [],
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all<T>(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows ?? []);
      }
    });
  });
}

export function queryOne<T = unknown>(
  db: DatabaseConnection,
  sql: string,
  params: SqlParams = [],
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get<T>(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Resolves to the affected-row count. A write that needs data back should use
// queryOne with an explicit RETURNING clause instead.
export function execute(
  db: DatabaseConnection,
  sql: string,
  params: SqlParams = [],
): Promise<number> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes ?? 0);
      }
    });
  });
}

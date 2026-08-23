// Database connection interface for PostgreSQL compatibility

// Values accepted as bound query parameters. Mirrors what `pg` can serialize
// into a parameterized query; widen here if a caller needs a new shape.
export type SqlParam =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | string[];
export type SqlParams = SqlParam[];

export interface RunCallbackContext {
  lastID?: string | number;
  changes?: number;
}

export type RunCallback = (this: RunCallbackContext, err: Error | null) => void;

export interface DatabaseConnection {
  prepare(sql: string): PreparedStatement;
  run(sql: string, params?: SqlParams, callback?: RunCallback): RunResult;
  // T is the row shape; callers annotate their callback (or pass `<Row>`) to
  // recover typed rows. Defaults to unknown so an unannotated callback is safe.
  all<T = unknown>(
    sql: string,
    params?: SqlParams,
    callback?: (err: Error | null, rows?: T[]) => void,
  ): void;
  get<T = unknown>(
    sql: string,
    params?: SqlParams,
    callback?: (err: Error | null, row?: T) => void,
  ): void;
  serialize(callback: () => void): void;
  close(callback?: (err: Error | null) => void): void;
}

export interface PreparedStatement {
  run(params: SqlParams, callback?: RunCallback): RunResult;
  finalize(callback?: (err: Error | null) => void): void;
}

export interface RunResult {
  lastID?: string | number;
  changes?: number;
}

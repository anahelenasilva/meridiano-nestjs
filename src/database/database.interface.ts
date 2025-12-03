// Database connection interface that mimics SQLite API for compatibility
export interface RunCallbackContext {
  lastID?: number;
  changes?: number;
}

export type RunCallback = (this: RunCallbackContext, err: Error | null) => void;

export interface DatabaseConnection {
  prepare(sql: string): PreparedStatement;
  run(sql: string, params?: any[], callback?: RunCallback): RunResult;
  all(
    sql: string,
    params?: any[],
    callback?: (err: Error | null, rows?: any[]) => void,
  ): void;
  get(
    sql: string,
    params?: any[],
    callback?: (err: Error | null, row?: any) => void,
  ): void;
  serialize(callback: () => void): void;
  close(callback?: (err: Error | null) => void): void;
}

export interface PreparedStatement {
  run(params: any[], callback?: RunCallback): RunResult;
  finalize(callback?: (err: Error | null) => void): void;
}

export interface RunResult {
  lastID?: number;
  changes?: number;
}

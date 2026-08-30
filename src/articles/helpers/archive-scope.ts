export type ArchiveScope = 'active' | 'archived' | 'all';

const VALID_SCOPES: readonly ArchiveScope[] = ['active', 'archived', 'all'];

/**
 * SQL fragment restricting a query to active or archived rows. Returns an
 * empty string for 'all', so callers must guard before appending:
 *
 *   const clause = archiveClause(scope);
 *   if (clause) query += ` AND ${clause}`;
 *
 * `column` exists for joined queries that need a table alias, such as the
 * bookmarks query's `a.archived_at`.
 */
export function archiveClause(
  scope: ArchiveScope,
  column = 'archived_at',
): string {
  switch (scope) {
    case 'active':
      return `${column} IS NULL`;
    case 'archived':
      return `${column} IS NOT NULL`;
    case 'all':
      return '';
  }
}

/**
 * Null means "the caller sent something invalid", which the HTTP layer turns
 * into a 400. Absent means the default scope, not an error.
 */
export function parseArchiveScope(value: unknown): ArchiveScope | null {
  if (value === undefined || value === null || value === '') {
    return 'active';
  }

  return VALID_SCOPES.includes(value as ArchiveScope)
    ? (value as ArchiveScope)
    : null;
}

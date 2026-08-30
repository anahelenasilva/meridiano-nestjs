import { archiveClause, parseArchiveScope } from './archive-scope';

describe('archiveClause', () => {
  it('excludes archived rows for the active scope', () => {
    expect(archiveClause('active')).toBe('archived_at IS NULL');
  });

  it('selects only archived rows for the archived scope', () => {
    expect(archiveClause('archived')).toBe('archived_at IS NOT NULL');
  });

  it('returns an empty fragment for the all scope so callers append nothing', () => {
    expect(archiveClause('all')).toBe('');
  });

  it('qualifies the column when one is given, for joined queries', () => {
    expect(archiveClause('active', 'a.archived_at')).toBe('a.archived_at IS NULL');
    expect(archiveClause('archived', 'a.archived_at')).toBe(
      'a.archived_at IS NOT NULL',
    );
  });
});

describe('parseArchiveScope', () => {
  it('defaults to active for an absent or empty value', () => {
    expect(parseArchiveScope(undefined)).toBe('active');
    expect(parseArchiveScope('')).toBe('active');
  });

  it('accepts the three valid scopes', () => {
    expect(parseArchiveScope('active')).toBe('active');
    expect(parseArchiveScope('archived')).toBe('archived');
    expect(parseArchiveScope('all')).toBe('all');
  });

  it('returns null for an unrecognised value so the caller can reject it', () => {
    expect(parseArchiveScope('deleted')).toBeNull();
    expect(parseArchiveScope(7)).toBeNull();
  });
});

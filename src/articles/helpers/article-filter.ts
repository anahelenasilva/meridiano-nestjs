import { SqlParams } from '@libs/database';
import {
  CalendarUnit,
  meridianoDate,
  startOfMeridianoDay,
  startOfNextMeridianoDay,
  subtractFromMeridianoDate,
} from '../../shared/helpers/meridiano-day';
import { archiveClause, ArchiveScope } from './archive-scope';

export type ArticleFilter = {
  feedProfile?: string;
  feedSource?: string;
  searchTerm?: string;
  // Meridiano Days as YYYY-MM-DD, both inclusive.
  startDate?: string;
  endDate?: string;
  // A known preset replaces startDate/endDate; an unknown one is ignored.
  preset?: string;
  category?: string;
  // Absent means 'active': archived Articles appear only when a caller asks.
  archiveScope?: ArchiveScope;
};

const PRESET_LOOKBACKS = new Map<string, readonly [number, CalendarUnit]>([
  ['last_week', [7, 'days']],
  ['last_30d', [30, 'days']],
  ['last_3m', [3, 'months']],
  ['last_12m', [12, 'months']],
]);

function presetWindow(
  preset: string,
  now: Date,
): { startDate: string; endDate: string } | undefined {
  if (preset === 'yesterday') {
    const yesterday = subtractFromMeridianoDate(now, 1, 'days');
    return { startDate: yesterday, endDate: yesterday };
  }

  const lookback = PRESET_LOOKBACKS.get(preset);
  if (!lookback) {
    return undefined;
  }

  const [amount, unit] = lookback;
  return {
    startDate: subtractFromMeridianoDate(now, amount, unit),
    endDate: meridianoDate(now),
  };
}

/**
 * Compiles a filter to a WHERE body (without the keyword) and its params, for
 * queries against the unaliased `articles` table. Preset windows are Meridiano
 * Days relative to `now`.
 */
export function compileArticleFilter(
  filter: ArticleFilter,
  now = new Date(),
): { where: string; params: SqlParams } {
  const { feedProfile, feedSource, searchTerm, category, preset } = filter;
  const window = preset ? presetWindow(preset, now) : undefined;
  const startDate = window?.startDate ?? filter.startDate;
  const endDate = window?.endDate ?? filter.endDate;

  const clauses: string[] = [];
  const params: SqlParams = [];

  const scopeClause = archiveClause(filter.archiveScope ?? 'active');
  if (scopeClause) {
    clauses.push(scopeClause);
  }

  if (feedProfile) {
    clauses.push('feed_profile = ?');
    params.push(feedProfile);
  }

  if (feedSource) {
    clauses.push('feed_source = ?');
    params.push(feedSource);
  }

  if (searchTerm) {
    clauses.push(
      '(title LIKE ? OR raw_content LIKE ? OR processed_content LIKE ?)',
    );
    const searchPattern = `%${searchTerm}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  // Compared as instants, not through DATE(published_date): the column holds a
  // UTC wall clock, so truncating it cuts the day at 21:00 in Sao Paulo and
  // disagrees with the News Digest (issue #333). Half-open, so all of endDate
  // is inside the window.
  if (startDate) {
    clauses.push('published_date >= ?');
    params.push(startOfMeridianoDay(startDate).toISOString());
  }

  if (endDate) {
    clauses.push('published_date < ?');
    params.push(startOfNextMeridianoDay(endDate).toISOString());
  }

  if (category) {
    clauses.push('categories LIKE ?');
    params.push(`%"${category}"%`);
  }

  return {
    where: clauses.length > 0 ? clauses.join(' AND ') : 'TRUE',
    params,
  };
}

import {
  subtractFromDate,
  toLocalDateString,
} from '../../shared/helpers/date-math';

// A bare `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. `new Date` reads these as UTC
// midnight, so the fallback appends a time to read them as local midnight.
const DATE_ONLY = /^\d{4}(-\d{2}){0,2}$/;

/**
 * Parse relative time string (e.g., "11 hours ago", "2 days ago") into a Date
 * @param relativeTime - Relative time string from YouTube
 * @returns ISO date string or 'Unknown' if parsing fails
 */
export function parseRelativeTime(relativeTime: string): string {
  if (!relativeTime || relativeTime === 'Unknown') {
    return 'Unknown';
  }

  try {
    const now = new Date();
    const lowerTime = relativeTime.toLowerCase().trim();

    // Match patterns like "11 hours ago", "2 days ago", "3 weeks ago", etc.
    const patterns = [
      { regex: /(\d+)\s*(second|seconds)\s*ago/i, unit: 'seconds' as const },
      { regex: /(\d+)\s*(minute|minutes)\s*ago/i, unit: 'minutes' as const },
      { regex: /(\d+)\s*(hour|hours)\s*ago/i, unit: 'hours' as const },
      { regex: /(\d+)\s*(day|days)\s*ago/i, unit: 'days' as const },
      { regex: /(\d+)\s*(week|weeks)\s*ago/i, unit: 'weeks' as const },
      { regex: /(\d+)\s*(month|months)\s*ago/i, unit: 'months' as const },
      { regex: /(\d+)\s*(year|years)\s*ago/i, unit: 'years' as const },
    ];

    for (const pattern of patterns) {
      const match = lowerTime.match(pattern.regex);
      if (match) {
        const amount = parseInt(match[1], 10);
        return subtractFromDate(now, amount, pattern.unit).toISOString();
      }
    }

    // If no pattern matches, try to parse as a regular date
    const isDateOnly = DATE_ONLY.test(relativeTime);
    const parsed = new Date(
      isDateOnly ? `${relativeTime}T00:00` : relativeTime,
    );
    // `new Date` rolls `2024-02-30` over to Mar 1 instead of rejecting it.
    const rolledOver =
      isDateOnly && !toLocalDateString(parsed).startsWith(relativeTime);
    if (!Number.isNaN(parsed.getTime()) && !rolledOver) {
      return parsed.toISOString();
    }

    return 'Unknown';
  } catch (error) {
    console.warn(`Failed to parse relative time: ${relativeTime}`, error);
    return 'Unknown';
  }
}

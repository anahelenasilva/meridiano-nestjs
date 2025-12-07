import moment from 'moment';

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
    const now = moment();
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
        const date = now.clone().subtract(amount, pattern.unit);
        return date.toISOString();
      }
    }

    // If no pattern matches, try to parse as a regular date
    const parsed = moment(relativeTime);
    if (parsed.isValid()) {
      return parsed.toISOString();
    }

    return 'Unknown';
  } catch (error) {
    console.warn(`Failed to parse relative time: ${relativeTime}`, error);
    return 'Unknown';
  }
}

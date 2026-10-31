/**
 * The Meridiano Day: the calendar day Meridiano's single reader is living in,
 * which is a day in Sao Paulo and never a day in the host's zone. Every day
 * boundary the app resolves goes through this module, so a container in UTC and
 * a laptop in BRT answer "which articles are yesterday's" identically.
 *
 * Nothing in the repo sets `TZ`, so the zone is named here instead of read from
 * the process (issue #333, ADR-0012). The zone is named rather than offset so
 * that Brazil reinstating summer time would need no change here.
 */
const MERIDIANO_TIME_ZONE = 'America/Sao_Paulo';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const DAYS_PER_UNIT = { days: 1, weeks: 7 } as const;
const MONTHS_PER_UNIT = { months: 1, years: 12 } as const;

/** Units that move a calendar day. Hours and finer are not a day's business. */
export type CalendarUnit =
  | keyof typeof DAYS_PER_UNIT
  | keyof typeof MONTHS_PER_UNIT;

const zonedFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: MERIDIANO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function numericPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const part = parts.find((candidate) => candidate.type === type);
  if (!part) {
    throw new Error(
      `Intl returned no ${type} for ${MERIDIANO_TIME_ZONE}; the runtime is missing time zone data`,
    );
  }
  return Number(part.value);
}

function zonedFields(instant: Date) {
  const parts = zonedFormat.formatToParts(instant);
  return {
    year: numericPart(parts, 'year'),
    month: numericPart(parts, 'month'),
    day: numericPart(parts, 'day'),
    hour: numericPart(parts, 'hour'),
    minute: numericPart(parts, 'minute'),
    second: numericPart(parts, 'second'),
  };
}

// A calendar date carries no instant, so it rides as UTC midnight: the fields
// round-trip exactly, out-of-range ones normalise (month 13 is next January),
// and toISOString prints the YYYY-MM-DD the API and SQL both speak.
function calendarDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function parseCalendarDate(date: string) {
  if (DATE_ONLY.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    // Round-tripping rejects a day the month does not have: Date.UTC rolls
    // February 30 forward to March 2 rather than refusing it.
    if (calendarDate(year, month, day) === date) {
      return { year, month, day };
    }
  }

  throw new Error(
    `A Meridiano Day is a calendar date as YYYY-MM-DD, got "${date}"`,
  );
}

// Milliseconds to add to `instant` to read it as a Sao Paulo wall clock.
function offsetMs(instant: Date): number {
  const { year, month, day, hour, minute, second } = zonedFields(instant);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asIfUtc - (instant.getTime() - instant.getMilliseconds());
}

/** The Meridiano Day `instant` falls on, as `YYYY-MM-DD`. */
export function meridianoDate(instant: Date): string {
  const { year, month, day } = zonedFields(instant);
  return calendarDate(year, month, day);
}

/**
 * The Meridiano Day `amount` units before the one `instant` falls on. Days and
 * weeks walk the calendar, months and years clamp to the target month's last
 * day, so three months before May 31 is the end of February.
 */
export function subtractFromMeridianoDate(
  instant: Date,
  amount: number,
  unit: CalendarUnit,
): string {
  const { year, month, day } = zonedFields(instant);

  if (unit === 'days' || unit === 'weeks') {
    return calendarDate(year, month, day - amount * DAYS_PER_UNIT[unit]);
  }

  const months = amount * MONTHS_PER_UNIT[unit];
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month - months, 0),
  ).getUTCDate();
  return calendarDate(year, month - months, Math.min(day, lastDayOfTargetMonth));
}

/** The instant the Meridiano Day `date` starts: a window's inclusive bound. */
export function startOfMeridianoDay(date: string): Date {
  const { year, month, day } = parseCalendarDate(date);
  const midnightAsIfUtc = Date.UTC(year, month - 1, day);

  // The zone's offset is a function of an instant, so landing on the instant
  // whose wall clock reads midnight takes a second pass: the first guess can
  // sit on the far side of a transition.
  const firstGuess = midnightAsIfUtc - offsetMs(new Date(midnightAsIfUtc));
  const start = new Date(midnightAsIfUtc - offsetMs(new Date(firstGuess)));

  // A midnight that a forward jump skipped never happens, and that day starts
  // at the jump instead. Sao Paulo moved its clocks at midnight until Brazil
  // abolished DST in 2019, so its old October days need this.
  return meridianoDate(start) === date ? start : new Date(firstGuess);
}

/**
 * The instant the Meridiano Day after `date` starts, which is how a window
 * ending on `date` keeps all of `date` inside it: `published_date < bound`.
 */
export function startOfNextMeridianoDay(date: string): Date {
  const { year, month, day } = parseCalendarDate(date);
  return startOfMeridianoDay(calendarDate(year, month, day + 1));
}

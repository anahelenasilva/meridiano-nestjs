const MS_PER_UNIT = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
} as const;

const DAYS_PER_UNIT = { days: 1, weeks: 7 } as const;

const MONTHS_PER_UNIT = { months: 1, years: 12 } as const;

export type DateUnit =
  | keyof typeof MS_PER_UNIT
  | keyof typeof DAYS_PER_UNIT
  | keyof typeof MONTHS_PER_UNIT;

/**
 * Returns a new Date `amount` units before `date`. Seconds to hours are
 * absolute time, days and weeks move the local calendar, and months and years
 * clamp to the target month's last day (May 31 minus 3 months is Feb 29).
 */
export function subtractFromDate(
  date: Date,
  amount: number,
  unit: DateUnit,
): Date {
  switch (unit) {
    case 'seconds':
    case 'minutes':
    case 'hours':
      return new Date(date.getTime() - amount * MS_PER_UNIT[unit]);
    case 'days':
    case 'weeks': {
      const result = new Date(date);
      result.setDate(result.getDate() - amount * DAYS_PER_UNIT[unit]);
      return result;
    }
    case 'months':
    case 'years':
      return subtractMonths(date, amount * MONTHS_PER_UNIT[unit]);
  }
}

// Sets year, month and day in one call so no intermediate date can land in a
// DST gap and shift the wall-clock hour.
function subtractMonths(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth() - months;
  const lastDayOfTargetMonth = new Date(year, month + 1, 0).getDate();
  const result = new Date(date);
  result.setFullYear(
    year,
    month,
    Math.min(date.getDate(), lastDayOfTargetMonth),
  );
  return result;
}

/** Formats `date` as `YYYY-MM-DD` in the server's time zone, not UTC. */
export function toLocalDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

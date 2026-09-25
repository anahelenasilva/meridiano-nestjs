const MS_PER_UNIT = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
} as const;

export type DateUnit =
  | keyof typeof MS_PER_UNIT
  | 'days'
  | 'weeks'
  | 'months'
  | 'years';

/**
 * Returns a new Date `amount` units before `date`, matching moment's
 * `subtract`: seconds to hours are absolute time, days and weeks move the
 * local calendar, and months and years clamp to the target month's last day.
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
      result.setDate(result.getDate() - amount * (unit === 'weeks' ? 7 : 1));
      return result;
    }
    case 'months':
    case 'years':
      return subtractMonths(date, amount * (unit === 'years' ? 12 : 1));
  }
}

function subtractMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setMonth(result.getMonth() - months);
  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(date.getDate(), lastDayOfTargetMonth));
  return result;
}

/** Formats `date` as `YYYY-MM-DD` in the server's local time zone. */
export function toLocalDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

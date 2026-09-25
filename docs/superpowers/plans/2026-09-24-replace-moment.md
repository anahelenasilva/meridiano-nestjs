# Replace moment with native Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drop the `moment` dependency and compute the same dates with native `Date`.

**Architecture:** One small helper module, `src/shared/helpers/date-math.ts`, owns the two things moment did for us: calendar subtraction (with moment's month-end clamping) and local `YYYY-MM-DD` formatting. The two call sites, `parseRelativeTime` and `ListArticlesQuery.parseDatePreset`, switch to it. The last task removes the package.

**Tech Stack:** NestJS, TypeScript 5.9, Jest 30 (fake timers via `jest.useFakeTimers({ now })`), pnpm.

**Spec:** GitHub issue #80 (`gh issue view 80`), "deps: replace moment.js with native Date arithmetic".

## Corrections to the issue

The issue's file list is stale. Verified on `main` at `2b3c9a5`:

- `moment` is imported in `src/articles/queries/list-articles.query.ts:5`, `src/youtube-transcriptions/helpers/parse-relative-time.ts:1`, and the spec `src/youtube-transcriptions/helpers/parse-relative-time.spec.ts:1`.
- `src/youtube-transcriptions/queries/list-youtube-transcriptions.query.ts` does not use moment. `src/utils/` does not exist.
- `date-fns` is not a dependency. Use native `Date` only.

## Global Constraints

- No new date library. Native `Date` only.
- `parseRelativeTime` keeps its contract: returns an ISO string (`Date.prototype.toISOString`, UTC) or the literal `'Unknown'`.
- `parseDatePreset` keeps its contract: `startDate` / `endDate` are `YYYY-MM-DD` in the server's local time zone, exactly what `moment().format('YYYY-MM-DD')` produced.
- Month and year subtraction clamps to the last day of the target month, like moment (`2024-03-31` minus 1 month is `2024-02-29`, not `2024-03-02`).
- Day and week subtraction is calendar-based in local time (`setDate`), like moment. Second, minute, and hour subtraction is absolute milliseconds, like moment.
- Before each commit: `pnpm lint`, `pnpm typecheck`, and the task's tests pass.

## Review Focus

1. **Month-end dates.** `last_3m` on May 31, or `"1 month ago"` on May 31, must clamp (Feb 29, Apr 30). Native `setMonth` overflows into the next month. Pinned in Task 1, Task 2, and Task 3.
2. **Late evening in a negative UTC offset.** At 22:30 in São Paulo it is already tomorrow in UTC. Preset `endDate` must be the local date, so formatting via `toISOString().slice(0, 10)` is a bug. Pinned in Task 1 and Task 3 (the tests freeze time at 22:30 local, which catches this on any machine west of UTC, including Ana's).
3. **Date-only strings.** moment parses `'2024-01-15'` as local midnight. `new Date('2024-01-15')` parses it as UTC midnight. `parseRelativeTime` must keep the local reading. Pinned in Task 2.
4. **Prefixed YouTube text.** YouTube sends strings like `"Streamed 2 days ago"`. The unanchored regexes match these today and must keep matching. Pinned in Task 2.
5. **Unknown preset.** A preset the switch does not know must leave the request's own `startDate` / `endDate` untouched. Pinned in Task 3.

Out of scope, noticed while planning: `ListArticlesQuery.execute` passes preset dates to `countTotalArticles` but passes the raw request dates to `getArticlesPaginated` (`list-articles.query.ts:112-113` vs `128-129`). That is a separate bug. Do not fix it here.

---

### Task 1: Native date helper

**Files:**
- Create: `src/shared/helpers/date-math.ts`
- Test: `src/shared/helpers/date-math.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type DateUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'`
  - `export function subtractFromDate(date: Date, amount: number, unit: DateUnit): Date` (returns a new `Date`, never mutates `date`)
  - `export function toLocalDateString(date: Date): string` (`YYYY-MM-DD` in local time)

- [ ] **Step 1: Write the failing test**

Create `src/shared/helpers/date-math.spec.ts`. Build expected dates with the local `new Date(y, m, d, h, min)` constructor so the tests hold in any time zone.

```ts
import { subtractFromDate, toLocalDateString } from './date-math';

describe('subtractFromDate', () => {
  it.each([
    ['seconds', 30, '2024-05-31T11:59:30.000Z'],
    ['minutes', 15, '2024-05-31T11:45:00.000Z'],
    ['hours', 11, '2024-05-31T01:00:00.000Z'],
  ] as const)('subtracts %s as absolute time', (unit, amount, expected) => {
    const from = new Date('2024-05-31T12:00:00.000Z');

    expect(subtractFromDate(from, amount, unit).toISOString()).toBe(expected);
  });

  it('subtracts days on the local calendar, across a year boundary', () => {
    const from = new Date(2024, 0, 3, 9, 0);

    expect(subtractFromDate(from, 5, 'days')).toEqual(
      new Date(2023, 11, 29, 9, 0),
    );
  });

  it('subtracts weeks as seven calendar days each', () => {
    const from = new Date(2024, 2, 10, 9, 0);

    expect(subtractFromDate(from, 2, 'weeks')).toEqual(
      new Date(2024, 1, 25, 9, 0),
    );
  });

  it('clamps to the last day of a shorter target month', () => {
    const from = new Date(2024, 2, 31, 9, 0);

    expect(subtractFromDate(from, 1, 'months')).toEqual(
      new Date(2024, 1, 29, 9, 0),
    );
    expect(subtractFromDate(from, 13, 'months')).toEqual(
      new Date(2023, 1, 28, 9, 0),
    );
  });

  it('clamps Feb 29 to Feb 28 when subtracting into a non-leap year', () => {
    const from = new Date(2024, 1, 29, 9, 0);

    expect(subtractFromDate(from, 1, 'years')).toEqual(
      new Date(2023, 1, 28, 9, 0),
    );
  });

  it('does not mutate the input date', () => {
    const from = new Date(2024, 2, 31, 9, 0);
    const before = from.getTime();

    subtractFromDate(from, 3, 'months');
    subtractFromDate(from, 3, 'days');
    subtractFromDate(from, 3, 'hours');

    expect(from.getTime()).toBe(before);
  });
});

describe('toLocalDateString', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(toLocalDateString(new Date(2024, 0, 5, 9, 0))).toBe('2024-01-05');
  });

  it('uses the local date even when UTC has already rolled over', () => {
    expect(toLocalDateString(new Date(2024, 10, 15, 23, 30))).toBe(
      '2024-11-15',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/shared/helpers/date-math.spec.ts`
Expected: FAIL with `Cannot find module './date-math'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/shared/helpers/date-math.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/shared/helpers/date-math.spec.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add src/shared/helpers/date-math.ts src/shared/helpers/date-math.spec.ts
git commit -m "feat(shared): add native date subtraction and local date formatting"
```

---

### Task 2: `parseRelativeTime` on native Date

**Files:**
- Modify: `src/youtube-transcriptions/helpers/parse-relative-time.ts` (whole file, 48 lines)
- Test: `src/youtube-transcriptions/helpers/parse-relative-time.spec.ts` (rewrite, it imports moment)

**Interfaces:**
- Consumes: `subtractFromDate(date: Date, amount: number, unit: DateUnit): Date` from `src/shared/helpers/date-math.ts` (Task 1).
- Produces: `parseRelativeTime(relativeTime: string): string`, signature unchanged. Only caller: `src/youtube-transcriptions/services/youtube.service.ts:124`.

- [ ] **Step 1: Rewrite the spec without moment**

Replace the whole of `src/youtube-transcriptions/helpers/parse-relative-time.spec.ts`. The old spec compared against `moment()` with a 1 second tolerance. The new one freezes the clock, so every expectation is exact. `NOW` is 22:30 local on May 31 so month cases exercise clamping.

```ts
import { parseRelativeTime } from './parse-relative-time';

const NOW = new Date(2024, 4, 31, 22, 30);

describe('parseRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([
    ['5 seconds ago', new Date(2024, 4, 31, 22, 29, 55)],
    ['30 seconds ago', new Date(2024, 4, 31, 22, 29, 30)],
    ['1 minute ago', new Date(2024, 4, 31, 22, 29)],
    ['15 minutes ago', new Date(2024, 4, 31, 22, 15)],
    ['1 hour ago', new Date(2024, 4, 31, 21, 30)],
    ['11 hours ago', new Date(2024, 4, 31, 11, 30)],
    ['1 day ago', new Date(2024, 4, 30, 22, 30)],
    ['2 days ago', new Date(2024, 4, 29, 22, 30)],
    ['1 week ago', new Date(2024, 4, 24, 22, 30)],
    ['3 weeks ago', new Date(2024, 4, 10, 22, 30)],
    ['1 month ago', new Date(2024, 3, 30, 22, 30)],
    ['6 months ago', new Date(2023, 10, 30, 22, 30)],
    ['1 year ago', new Date(2023, 4, 31, 22, 30)],
    ['2 years ago', new Date(2022, 4, 31, 22, 30)],
    ['1000 days ago', new Date(2024, 4, 31 - 1000, 22, 30)],
    ['0 hours ago', NOW],
  ])('parses "%s"', (input, expected) => {
    expect(parseRelativeTime(input)).toBe(expected.toISOString());
  });

  it.each([
    ['5 HOURS AGO', new Date(2024, 4, 31, 17, 30)],
    ['3 DaYs AgO', new Date(2024, 4, 28, 22, 30)],
    ['  5   hours   ago  ', new Date(2024, 4, 31, 17, 30)],
    ['Streamed 2 days ago', new Date(2024, 4, 29, 22, 30)],
  ])('tolerates case, spacing, and prefixes in "%s"', (input, expected) => {
    expect(parseRelativeTime(input)).toBe(expected.toISOString());
  });

  it.each([
    ['2024-01-15T10:30:00Z', '2024-01-15T10:30:00.000Z'],
    ['2024-01-15', new Date(2024, 0, 15).toISOString()],
    ['2024-01-15 10:30:00', new Date(2024, 0, 15, 10, 30).toISOString()],
    ['Mar 3, 2024', new Date(2024, 2, 3).toISOString()],
  ])('falls back to parsing "%s" as a date', (input, expected) => {
    expect(parseRelativeTime(input)).toBe(expected);
  });

  it.each([
    '',
    null as unknown as string,
    undefined as unknown as string,
    'Unknown',
    'invalid time string',
    'ago 5 hours',
    'not a date',
    'hours ago',
  ])('returns "Unknown" for %p', (input) => {
    expect(parseRelativeTime(input)).toBe('Unknown');
  });
});
```

- [ ] **Step 2: Run the spec against the current implementation**

Run: `pnpm test src/youtube-transcriptions/helpers/parse-relative-time.spec.ts`
Expected: PASS. The spec no longer imports moment, but the implementation still does, so this proves the new spec describes today's behavior before we change it. If any case fails here, stop: the spec is wrong, not the code.

- [ ] **Step 3: Swap the implementation to native Date**

Edit `src/youtube-transcriptions/helpers/parse-relative-time.ts`. Three changes: the import, `now`, and the two moment calls. The pattern table keeps its `as const` units, which already satisfy `DateUnit`.

Replace line 1:

```ts
import { subtractFromDate } from '../../shared/helpers/date-math';

// A bare `YYYY-MM-DD`. `new Date` reads it as UTC midnight, moment read it as
// local midnight, so the fallback appends a time to keep the local reading.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
```

Replace `const now = moment();` with:

```ts
    const now = new Date();
```

Replace:

```ts
        const date = now.clone().subtract(amount, pattern.unit);
        return date.toISOString();
```

with:

```ts
        return subtractFromDate(now, amount, pattern.unit).toISOString();
```

Replace:

```ts
    const parsed = moment(relativeTime);
    if (parsed.isValid()) {
      return parsed.toISOString();
    }
```

with:

```ts
    const parsed = new Date(
      DATE_ONLY.test(relativeTime) ? `${relativeTime}T00:00` : relativeTime,
    );
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
```

- [ ] **Step 4: Run the spec again**

Run: `pnpm test src/youtube-transcriptions/helpers/parse-relative-time.spec.ts`
Expected: PASS, same count as Step 2.

Then confirm the `DATE_ONLY` branch is load-bearing: temporarily change the ternary to plain `new Date(relativeTime)`, rerun, and expect the `"2024-01-15"` case to FAIL on any machine not on UTC. Restore the ternary.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
pnpm lint && pnpm typecheck
git add src/youtube-transcriptions/helpers/parse-relative-time.ts src/youtube-transcriptions/helpers/parse-relative-time.spec.ts
git commit -m "refactor(youtube-transcriptions): parse relative times with native Date"
```

---

### Task 3: Date presets on native Date, remove moment

**Files:**
- Modify: `src/articles/queries/list-articles.query.ts:5` (import) and `:180-221` (`parseDatePreset`)
- Test: `src/articles/queries/list-articles.query.spec.ts` (add a `describe` block at the end)
- Modify: `package.json:76`, `pnpm-lock.yaml` (via `pnpm remove`)

**Interfaces:**
- Consumes: `subtractFromDate(date: Date, amount: number, unit: DateUnit): Date` and `toLocalDateString(date: Date): string` from `src/shared/helpers/date-math.ts` (Task 1).
- Produces: nothing new. `ListArticlesQuery.execute(userId, request)` is unchanged; preset dates reach `ArticlesService.countTotalArticles` as `startDate` / `endDate`.

- [ ] **Step 1: Write the preset tests**

`parseDatePreset` is private, so the tests drive it through `execute` and read what `countTotalArticles` received. Append this block inside the top-level `describe('ListArticlesQuery', ...)` in `src/articles/queries/list-articles.query.spec.ts`, after the last existing `it`. It reuses the spec's existing `query`, `mockService`, and `userId`.

Time is frozen at 22:30 local on May 31: `last_3m` exercises the Feb 29 clamp, and on any machine west of UTC the UTC date is already June 1.

```ts
  describe('date presets', () => {
    beforeEach(() => {
      jest.useFakeTimers({ now: new Date(2024, 4, 31, 22, 30) });
      mockService.getArticlesPaginated.mockResolvedValue([]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it.each([
      ['yesterday', '2024-05-30', '2024-05-30'],
      ['last_week', '2024-05-24', '2024-05-31'],
      ['last_30d', '2024-05-01', '2024-05-31'],
      ['last_3m', '2024-02-29', '2024-05-31'],
      ['last_12m', '2023-05-31', '2024-05-31'],
    ])(
      'counts %s as %s to %s in local time',
      async (preset, startDate, endDate) => {
        await query.execute(userId, { preset });

        expect(mockService.countTotalArticles).toHaveBeenCalledWith(
          expect.objectContaining({ startDate, endDate }),
        );
      },
    );

    it('keeps the request dates for an unknown preset', async () => {
      await query.execute(userId, {
        preset: 'bogus',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      });

      expect(mockService.countTotalArticles).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        }),
      );
    });
  });
```

- [ ] **Step 2: Run the tests against the current implementation**

Run: `pnpm test src/articles/queries/list-articles.query.spec.ts`
Expected: PASS. These pin moment's behavior before the swap. If one fails, the test is wrong; fix it before touching the query.

- [ ] **Step 3: Swap `parseDatePreset` to the helper**

In `src/articles/queries/list-articles.query.ts`, replace line 5:

```ts
import moment from 'moment';
```

with:

```ts
import {
  subtractFromDate,
  toLocalDateString,
} from '../../shared/helpers/date-math';
```

Replace the whole `parseDatePreset` method (lines 180-221) with:

```ts
  private parseDatePreset(preset: string): {
    startDate?: string;
    endDate?: string;
  } {
    const now = new Date();
    const today = toLocalDateString(now);

    switch (preset) {
      case 'yesterday': {
        const yesterday = toLocalDateString(subtractFromDate(now, 1, 'days'));
        return { startDate: yesterday, endDate: yesterday };
      }
      case 'last_week':
        return {
          startDate: toLocalDateString(subtractFromDate(now, 7, 'days')),
          endDate: today,
        };
      case 'last_30d':
        return {
          startDate: toLocalDateString(subtractFromDate(now, 30, 'days')),
          endDate: today,
        };
      case 'last_3m':
        return {
          startDate: toLocalDateString(subtractFromDate(now, 3, 'months')),
          endDate: today,
        };
      case 'last_12m':
        return {
          startDate: toLocalDateString(subtractFromDate(now, 12, 'months')),
          endDate: today,
        };
      default:
        return {};
    }
  }
```

- [ ] **Step 4: Run the tests again**

Run: `pnpm test src/articles/queries/list-articles.query.spec.ts`
Expected: PASS, same count as Step 2.

- [ ] **Step 5: Remove the package and confirm nothing imports it**

```bash
pnpm remove moment
grep -rnE "from 'moment'|require\('moment'\)" src libs test
grep -n '"moment"' package.json
```

Expected: `package.json` and `pnpm-lock.yaml` lose `moment`, and both greps print nothing. (Two doc comments from Tasks 1 and 2 mention moment by name on purpose; the import pattern skips them.) If the grep finds a hit, it is a missed import: fix it, do not re-add the package.

- [ ] **Step 6: Full verification**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all four succeed. Run `pnpm test` with the Bash tool's own timeout, and kill any Jest process left running afterwards.

- [ ] **Step 7: Commit**

```bash
git add src/articles/queries/list-articles.query.ts src/articles/queries/list-articles.query.spec.ts package.json pnpm-lock.yaml
git commit -m "refactor(articles): compute date presets with native Date, drop moment"
```

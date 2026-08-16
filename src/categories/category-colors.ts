/**
 * Fixed category color palette. Mirrored identically in the frontend
 * (`meridiano-frontend`); keep both in sync when changing it.
 */
export const CATEGORY_COLORS = {
  pink: '#ec4899',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
} as const;

export const CATEGORY_COLOR_PALETTE: readonly string[] =
  Object.values(CATEGORY_COLORS);

/**
 * Picks a color for a new category: a not-yet-used palette color at random,
 * falling back to any palette color once all six are taken. `random` is
 * injectable so callers can make the choice deterministic in tests.
 */
export function pickCategoryColor(
  usedColors: string[],
  random: () => number = Math.random,
): string {
  const available = CATEGORY_COLOR_PALETTE.filter(
    (color) => !usedColors.includes(color),
  );
  const pool = available.length > 0 ? available : CATEGORY_COLOR_PALETTE;

  return pool[Math.floor(random() * pool.length)];
}

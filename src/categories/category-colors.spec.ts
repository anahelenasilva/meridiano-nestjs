import {
  CATEGORY_COLOR_PALETTE,
  CATEGORY_COLORS,
  pickCategoryColor,
} from './category-colors';

describe('pickCategoryColor', () => {
  it('always returns a color from the fixed palette', () => {
    const color = pickCategoryColor([]);
    expect(CATEGORY_COLOR_PALETTE).toContain(color);
  });

  it('prefers a not-yet-used color when some remain', () => {
    const used = [
      CATEGORY_COLORS.pink,
      CATEGORY_COLORS.blue,
      CATEGORY_COLORS.emerald,
      CATEGORY_COLORS.amber,
      CATEGORY_COLORS.violet,
    ];

    // Only cyan is free, so the choice is forced regardless of the RNG.
    expect(pickCategoryColor(used)).toBe(CATEGORY_COLORS.cyan);
  });

  it('never picks a used color while any are still available', () => {
    const used = [CATEGORY_COLORS.blue, CATEGORY_COLORS.emerald];

    // Force the RNG to the top of the available pool on every call.
    for (let i = 0; i < 20; i++) {
      const color = pickCategoryColor(used, () => 0);
      expect(used).not.toContain(color);
    }
  });

  it('falls back to any palette color once all six are taken', () => {
    const color = pickCategoryColor([...CATEGORY_COLOR_PALETTE], () => 0);
    expect(color).toBe(CATEGORY_COLOR_PALETTE[0]);
  });

  it('uses the injected RNG to index into the available pool', () => {
    // random() near 1 selects the last available color deterministically.
    const color = pickCategoryColor([], () => 0.999);
    expect(color).toBe(
      CATEGORY_COLOR_PALETTE[CATEGORY_COLOR_PALETTE.length - 1],
    );
  });
});

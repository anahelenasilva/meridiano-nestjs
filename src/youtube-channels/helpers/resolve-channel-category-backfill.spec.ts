import {
  CategoryRow,
  ChannelRow,
  resolveChannelCategoryBackfill,
} from './resolve-channel-category-backfill';

describe('resolveChannelCategoryBackfill', () => {
  const augusto: ChannelRow = {
    id: '11111111-1111-1111-1111-111111111111',
    channelId: 'UCLW51-XEzuOm5RwPMChHBMw',
  };
  const theo: ChannelRow = {
    id: '22222222-2222-2222-2222-222222222222',
    channelId: 'UCbRP3c757lWg9M-U7TyEkXA',
  };
  const channels: ChannelRow[] = [augusto, theo];

  const tech: CategoryRow = { id: 'category-tech', name: 'tech' };
  const ai: CategoryRow = { id: 'category-ai', name: 'AI' };
  const categories: CategoryRow[] = [tech, ai];

  it('resolves a mapped channel to its starter category pair', () => {
    const { pairs, unmatchedCategoryNames } = resolveChannelCategoryBackfill(
      [{ channelId: augusto.channelId, categoryNames: ['tech'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([{ channelId: augusto.id, categoryId: tech.id }]);
    expect(unmatchedCategoryNames).toEqual([]);
  });

  it('resolves a channel mapped to more than one starter category', () => {
    const { pairs, unmatchedCategoryNames } = resolveChannelCategoryBackfill(
      [{ channelId: theo.channelId, categoryNames: ['tech', 'AI'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([
      { channelId: theo.id, categoryId: tech.id },
      { channelId: theo.id, categoryId: ai.id },
    ]);
    expect(unmatchedCategoryNames).toEqual([]);
  });

  it('matches category names case-insensitively', () => {
    const { pairs, unmatchedCategoryNames } = resolveChannelCategoryBackfill(
      [{ channelId: theo.channelId, categoryNames: ['ai'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([{ channelId: theo.id, categoryId: ai.id }]);
    expect(unmatchedCategoryNames).toEqual([]);
  });

  it('skips a mapping whose channel is absent from the local database', () => {
    const { pairs, unmatchedCategoryNames } = resolveChannelCategoryBackfill(
      [{ channelId: 'UC-not-installed-locally', categoryNames: ['tech'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([]);
    expect(unmatchedCategoryNames).toEqual([]);
  });

  it('reports a category name matching no known category as unmatched', () => {
    const { pairs, unmatchedCategoryNames } = resolveChannelCategoryBackfill(
      [{ channelId: augusto.channelId, categoryNames: ['unknown-category'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([]);
    expect(unmatchedCategoryNames).toEqual(['unknown-category']);
  });

  it('does not report an unmatched category name for a mapping whose channel is absent', () => {
    const { pairs, unmatchedCategoryNames } = resolveChannelCategoryBackfill(
      [
        {
          channelId: 'UC-not-installed-locally',
          categoryNames: ['unknown-category'],
        },
      ],
      channels,
      categories,
    );

    expect(pairs).toEqual([]);
    expect(unmatchedCategoryNames).toEqual([]);
  });

  it('returns no pairs and no unmatched names when there are no mappings', () => {
    const { pairs, unmatchedCategoryNames } = resolveChannelCategoryBackfill(
      [],
      channels,
      categories,
    );

    expect(pairs).toEqual([]);
    expect(unmatchedCategoryNames).toEqual([]);
  });
});

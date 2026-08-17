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
    const pairs = resolveChannelCategoryBackfill(
      [{ channelId: augusto.channelId, categoryNames: ['tech'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([{ channelId: augusto.id, categoryId: tech.id }]);
  });

  it('resolves a channel mapped to more than one starter category', () => {
    const pairs = resolveChannelCategoryBackfill(
      [{ channelId: theo.channelId, categoryNames: ['tech', 'AI'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([
      { channelId: theo.id, categoryId: tech.id },
      { channelId: theo.id, categoryId: ai.id },
    ]);
  });

  it('matches category names case-insensitively', () => {
    const pairs = resolveChannelCategoryBackfill(
      [{ channelId: theo.channelId, categoryNames: ['ai'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([{ channelId: theo.id, categoryId: ai.id }]);
  });

  it('skips a mapping whose channel is absent from the local database', () => {
    const pairs = resolveChannelCategoryBackfill(
      [{ channelId: 'UC-not-installed-locally', categoryNames: ['tech'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([]);
  });

  it('skips a mapping whose category name matches no known category', () => {
    const pairs = resolveChannelCategoryBackfill(
      [{ channelId: augusto.channelId, categoryNames: ['unknown-category'] }],
      channels,
      categories,
    );

    expect(pairs).toEqual([]);
  });

  it('returns an empty array when there are no mappings', () => {
    expect(resolveChannelCategoryBackfill([], channels, categories)).toEqual(
      [],
    );
  });
});

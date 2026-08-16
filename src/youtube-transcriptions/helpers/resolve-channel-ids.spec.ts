import { ChannelIdentity, resolveChannelIds } from './resolve-channel-ids';

describe('resolveChannelIds', () => {
  // Mirrors the real split-channel data: Augusto Galego and PewDiePie each have
  // transcriptions stored under both their internal UUID and their external
  // YouTube id.
  const augustoInternal = '11111111-1111-1111-1111-111111111111';
  const pewdiepieInternal = '22222222-2222-2222-2222-222222222222';
  const theoInternal = '33333333-3333-3333-3333-333333333333';

  const channels: ChannelIdentity[] = [
    { id: augustoInternal, channelId: 'UCLW51-XEzuOm5RwPMChHBMw' },
    { id: pewdiepieInternal, channelId: 'UC-lHJZR3Gqxm24_Vd_AJ5Yw' },
    { id: theoInternal, channelId: 'UCbRP3c757lWg9M-U7TyEkXA' },
  ];

  it('keeps a stored id that is already an internal channel uuid', () => {
    const { resolved, orphans } = resolveChannelIds([theoInternal], channels);

    expect(orphans).toEqual([]);
    expect(resolved.get(theoInternal)).toBe(theoInternal);
  });

  it('translates a stored external youtube id to the internal uuid', () => {
    const { resolved, orphans } = resolveChannelIds(
      ['UCbRP3c757lWg9M-U7TyEkXA'],
      channels,
    );

    expect(orphans).toEqual([]);
    expect(resolved.get('UCbRP3c757lWg9M-U7TyEkXA')).toBe(theoInternal);
  });

  it('consolidates split channels: the uuid and external id resolve to the same channel', () => {
    const { resolved, orphans } = resolveChannelIds(
      [
        augustoInternal,
        'UCLW51-XEzuOm5RwPMChHBMw',
        pewdiepieInternal,
        'UC-lHJZR3Gqxm24_Vd_AJ5Yw',
      ],
      channels,
    );

    expect(orphans).toEqual([]);
    expect(resolved.get(augustoInternal)).toBe(augustoInternal);
    expect(resolved.get('UCLW51-XEzuOm5RwPMChHBMw')).toBe(augustoInternal);
    expect(resolved.get(pewdiepieInternal)).toBe(pewdiepieInternal);
    expect(resolved.get('UC-lHJZR3Gqxm24_Vd_AJ5Yw')).toBe(pewdiepieInternal);
  });

  it('reports a stored id matching no channel as an orphan', () => {
    const { resolved, orphans } = resolveChannelIds(
      [theoInternal, 'UC-fabricated-unmappable-id'],
      channels,
    );

    expect(resolved.get(theoInternal)).toBe(theoInternal);
    expect(resolved.has('UC-fabricated-unmappable-id')).toBe(false);
    expect(orphans).toEqual(['UC-fabricated-unmappable-id']);
  });
});

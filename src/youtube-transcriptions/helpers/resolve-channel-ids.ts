/**
 * Backfill resolver for the transcriptions -> channels FK refactor.
 *
 * Historical `youtube_transcriptions.channel_id` values are a mix of internal
 * channel UUIDs and external YouTube ids, and two channels are split across
 * both forms. This maps every stored id to the channel's internal UUID so a
 * real foreign key can be enforced. It never guesses: an id matching neither an
 * internal nor an external channel id is reported as an orphan, which the
 * migration treats as fatal (fail loud, roll back) rather than corrupting the
 * model.
 */

export interface ChannelIdentity {
  /** Internal channel UUID (youtube_channels.id). */
  id: string;
  /** External YouTube channel id (youtube_channels.channel_id). */
  channelId: string;
}

export interface ChannelIdResolution {
  /** Stored channel_id -> internal channel UUID, for every id that resolved. */
  resolved: Map<string, string>;
  /** Stored channel_ids that matched neither an internal nor an external id. */
  orphans: string[];
}

export function resolveChannelIds(
  storedChannelIds: readonly string[],
  channels: readonly ChannelIdentity[],
): ChannelIdResolution {
  const internalIds = new Set(channels.map((channel) => channel.id));
  const externalToInternal = new Map(
    channels.map((channel) => [channel.channelId, channel.id] as const),
  );

  const resolved = new Map<string, string>();
  const orphans: string[] = [];

  for (const stored of storedChannelIds) {
    if (internalIds.has(stored)) {
      // Already an internal id (recent rows) -> keep as-is.
      resolved.set(stored, stored);
    } else if (externalToInternal.has(stored)) {
      // External YouTube id -> translate to the owning channel's internal id.
      // Because a split channel's UUID and external id both land on the same
      // internal id, its rows consolidate onto one channel.
      resolved.set(stored, externalToInternal.get(stored)!);
    } else {
      orphans.push(stored);
    }
  }

  return { resolved, orphans };
}

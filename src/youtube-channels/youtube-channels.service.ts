import { DatabaseService, execute, queryAll, queryOne } from '@libs/database';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { YoutubeChannel } from './domain/youtube-channel';

interface ChannelRow {
  id: string;
  channel_id: string;
  name: string;
  url: string;
  description: string | null;
  enabled: boolean;
  max_videos: number | null;
  created_at: string;
  updated_at: string;
}

const CHANNEL_COLUMNS =
  'id, channel_id, name, url, description, enabled, max_videos, created_at, updated_at';

function mapChannelRow(row: ChannelRow): YoutubeChannel {
  return {
    id: row.id,
    channelId: row.channel_id,
    name: row.name,
    url: row.url,
    description: row.description,
    enabled: row.enabled,
    maxVideos: row.max_videos,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

@Injectable()
export class YoutubeChannelsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAllChannels(): Promise<YoutubeChannel[]> {
    const db = this.databaseService.getDbConnection();
    const rows = await queryAll<ChannelRow>(
      db,
      `SELECT ${CHANNEL_COLUMNS} FROM youtube_channels ORDER BY name`,
      [],
    );
    return rows.map(mapChannelRow);
  }

  async getEnabledChannels(): Promise<YoutubeChannel[]> {
    const db = this.databaseService.getDbConnection();
    const rows = await queryAll<ChannelRow>(
      db,
      `SELECT ${CHANNEL_COLUMNS} FROM youtube_channels WHERE enabled = true ORDER BY name`,
      [],
    );
    return rows.map(mapChannelRow);
  }

  async getChannelById(id: string): Promise<YoutubeChannel | null> {
    const db = this.databaseService.getDbConnection();
    const row = await queryOne<ChannelRow>(
      db,
      `SELECT ${CHANNEL_COLUMNS} FROM youtube_channels WHERE id = ?`,
      [id],
    );
    return row ? mapChannelRow(row) : null;
  }

  async updateChannelEnabled(
    channelId: string,
    enabled: boolean,
  ): Promise<void> {
    const db = this.databaseService.getDbConnection();
    const changes = await execute(
      db,
      'UPDATE youtube_channels SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [enabled, channelId],
    );

    if (changes === 0) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }
  }

  async createChannel(
    channelId: string,
    name: string,
    url: string,
    description: string,
    enabled: boolean,
    maxVideos?: number,
  ): Promise<YoutubeChannel> {
    const db = this.databaseService.getDbConnection();

    await execute(
      db,
      `
        INSERT INTO youtube_channels (channel_id, name, url, description, enabled, max_videos)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING ${CHANNEL_COLUMNS}
      `,
      [channelId, name, url, description, enabled, maxVideos ?? null],
    ).catch((err: unknown) => {
      const errorWithCode = err as Error & { code?: string; detail?: string };

      if (
        errorWithCode.message.includes('duplicate key value') ||
        errorWithCode.message.includes('UNIQUE constraint') ||
        errorWithCode.code === '23505'
      ) {
        const errorDetail = errorWithCode.detail || errorWithCode.message;

        if (errorDetail.includes('channel_id')) {
          throw new ConflictException('Channel ID already exists');
        }
        throw new ConflictException(
          'A channel with this information already exists',
        );
      }

      console.error('Error creating channel:', err);
      throw new InternalServerErrorException(
        'Failed to create channel. Please try again.',
      );
    });

    // Separate .catch so a read failure after a successful insert is not
    // reported as a failed create.
    const row = await queryOne<ChannelRow>(
      db,
      `SELECT ${CHANNEL_COLUMNS} FROM youtube_channels WHERE channel_id = ?`,
      [channelId],
    ).catch((err: unknown) => {
      console.error('Error fetching created channel:', err);
      throw new InternalServerErrorException(
        'Channel created but failed to fetch details',
      );
    });

    if (!row) {
      throw new InternalServerErrorException('Channel not found after creation');
    }

    return mapChannelRow(row);
  }
}

import { DatabaseService } from '@libs/database';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { YoutubeChannel } from './domain/youtube-channel';

@Injectable()
export class YoutubeChannelsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAllChannels(): Promise<YoutubeChannel[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        'SELECT id, channel_id, name, url, description, enabled, max_videos, created_at, updated_at FROM youtube_channels ORDER BY name',
        [],
        (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const channels: YoutubeChannel[] = rows.map((row) => ({
            id: row.id,
            channelId: row.channel_id,
            name: row.name,
            url: row.url,
            description: row.description,
            enabled: row.enabled,
            maxVideos: row.max_videos,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          }));

          resolve(channels);
        },
      );
    });
  }

  async getEnabledChannels(): Promise<YoutubeChannel[]> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        'SELECT id, channel_id, name, url, description, enabled, max_videos, created_at, updated_at FROM youtube_channels WHERE enabled = true ORDER BY name',
        [],
        (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          const channels: YoutubeChannel[] = rows.map((row) => ({
            id: row.id,
            channelId: row.channel_id,
            name: row.name,
            url: row.url,
            description: row.description,
            enabled: row.enabled,
            maxVideos: row.max_videos,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          }));

          resolve(channels);
        },
      );
    });
  }

  async getChannelById(channelId: string): Promise<YoutubeChannel | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.all(
        'SELECT id, channel_id, name, url, description, enabled, max_videos, created_at, updated_at FROM youtube_channels WHERE id = ?',
        [channelId],
        (err: Error | null, rows: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          if (!rows || rows.length === 0) {
            resolve(null);
            return;
          }

          const row = rows[0];
          const channel: YoutubeChannel = {
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

          resolve(channel);
        },
      );
    });
  }

  async updateChannelEnabled(
    channelId: string,
    enabled: boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.run(
        'UPDATE youtube_channels SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [enabled, channelId],
        function (err: Error | null) {
          if (err) {
            reject(err);
            return;
          }

          if (this.changes === 0) {
            reject(new Error(`Channel with ID ${channelId} not found`));
            return;
          }

          resolve();
        },
      );
    });
  }

  async createChannel(
    channelId: string,
    name: string,
    url: string,
    description: string,
    enabled: boolean,
    maxVideos?: number,
  ): Promise<YoutubeChannel> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.run(
        `
        INSERT INTO youtube_channels (channel_id, name, url, description, enabled, max_videos)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING id, channel_id, name, url, description, enabled, max_videos, created_at, updated_at
      `,
        [channelId, name, url, description, enabled, maxVideos ?? null],
        (err: Error | null) => {
          if (err) {
            const errorWithCode = err as Error & {
              code?: string;
              detail?: string;
            };

            if (
              err.message.includes('duplicate key value') ||
              err.message.includes('UNIQUE constraint') ||
              errorWithCode.code === '23505'
            ) {
              const errorDetail = errorWithCode.detail || err.message;

              if (errorDetail.includes('channel_id')) {
                reject(new ConflictException('Channel ID already exists'));
              } else {
                reject(
                  new ConflictException(
                    'A channel with this information already exists',
                  ),
                );
              }
            } else {
              console.error('Error creating channel:', err);
              reject(
                new InternalServerErrorException(
                  'Failed to create channel. Please try again.',
                ),
              );
            }
          } else {
            db.get(
              `SELECT id, channel_id, name, url, description, enabled, max_videos, created_at, updated_at FROM youtube_channels WHERE channel_id = ?`,
              [channelId],
              (getErr: Error | null, row?: any) => {
                if (getErr) {
                  console.error('Error fetching created channel:', getErr);
                  reject(
                    new InternalServerErrorException(
                      'Channel created but failed to fetch details',
                    ),
                  );
                } else if (!row) {
                  reject(
                    new InternalServerErrorException(
                      'Channel not found after creation',
                    ),
                  );
                } else {
                  const channel: YoutubeChannel = {
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
                  resolve(channel);
                }
              },
            );
          }
        },
      );
    });
  }
}

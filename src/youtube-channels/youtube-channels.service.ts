import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { YoutubeChannel } from './domain/youtube-channel';

@Injectable()
export class YoutubeChannelsService {
  constructor(private readonly databaseService: DatabaseService) { }

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
        'SELECT id, channel_id, name, url, description, enabled, max_videos, created_at, updated_at FROM youtube_channels WHERE channel_id = ?',
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
        'UPDATE youtube_channels SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE channel_id = ?',
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
}

import { DatabaseService, RunCallback } from '@libs/database';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { mock } from 'jest-mock-extended';
import { YoutubeChannelsService } from './youtube-channels.service';

const CHANNEL_ROW = {
  id: 'ch-1',
  channel_id: 'UC123',
  name: 'Fireship',
  url: 'https://youtube.com/@fireship',
  description: null,
  enabled: true,
  max_videos: 5,
  created_at: '2026-09-01T12:00:00.000Z',
  updated_at: '2026-09-02T12:00:00.000Z',
};

const CHANNEL = {
  id: 'ch-1',
  channelId: 'UC123',
  name: 'Fireship',
  url: 'https://youtube.com/@fireship',
  description: null,
  enabled: true,
  maxVideos: 5,
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
  updatedAt: new Date('2026-09-02T12:00:00.000Z'),
};

describe('YoutubeChannelsService', () => {
  const mockDatabaseService = mock<DatabaseService>();
  const mockDb = {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
  };
  let service: YoutubeChannelsService;

  const runReports = (changes: number) =>
    mockDb.run.mockImplementationOnce((sql, params, callback: RunCallback) => {
      callback.call({ changes }, null);
    });
  const runFails = (err: Error) =>
    mockDb.run.mockImplementationOnce((sql, params, callback: RunCallback) => {
      callback.call({}, err);
    });

  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: an unconsumed mockImplementationOnce
    // from a failing test would otherwise leak into the next one.
    jest.resetAllMocks();
    mockDatabaseService.getDbConnection.mockReturnValue(mockDb as never);
    service = new YoutubeChannelsService(mockDatabaseService);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('getAllChannels maps rows to channels', async () => {
    mockDb.all.mockImplementationOnce((sql, params, callback) => {
      callback(null, [CHANNEL_ROW]);
    });

    await expect(service.getAllChannels()).resolves.toEqual([CHANNEL]);
  });

  describe('getChannelById', () => {
    it('maps the matching row', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, CHANNEL_ROW);
      });

      await expect(service.getChannelById('ch-1')).resolves.toEqual(CHANNEL);
    });

    it('resolves null when no channel matches', async () => {
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, undefined);
      });

      await expect(service.getChannelById('missing')).resolves.toBeNull();
    });
  });

  describe('updateChannelEnabled', () => {
    it('resolves when a row changed', async () => {
      runReports(1);

      await expect(
        service.updateChannelEnabled('ch-1', false),
      ).resolves.toBeUndefined();
    });

    it('rejects when no channel has that id', async () => {
      runReports(0);

      await expect(
        service.updateChannelEnabled('missing', false),
      ).rejects.toThrow('Channel with ID missing not found');
    });
  });

  describe('createChannel', () => {
    it('returns the fetched channel after inserting', async () => {
      runReports(1);
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(null, CHANNEL_ROW);
      });

      await expect(
        service.createChannel(
          'UC123',
          'Fireship',
          'https://youtube.com/@fireship',
          '',
          true,
          5,
        ),
      ).resolves.toEqual(CHANNEL);
    });

    it('maps a channel_id unique violation to a ConflictException', async () => {
      runFails(
        Object.assign(
          new Error('duplicate key value violates unique constraint'),
          {
            code: '23505',
            detail: 'Key (channel_id)=(UC123) already exists.',
          },
        ),
      );

      await expect(
        service.createChannel(
          'UC123',
          'Fireship',
          'https://youtube.com/@fireship',
          '',
          true,
        ),
      ).rejects.toThrow(new ConflictException('Channel ID already exists'));
    });

    it('maps any other insert failure to an InternalServerErrorException', async () => {
      runFails(new Error('connection reset'));

      await expect(
        service.createChannel(
          'UC123',
          'Fireship',
          'https://youtube.com/@fireship',
          '',
          true,
        ),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'Failed to create channel. Please try again.',
        ),
      );
    });

    it('reports a fetch failure after a successful insert as its own error', async () => {
      runReports(1);
      mockDb.get.mockImplementationOnce((sql, params, callback) => {
        callback(new Error('read timeout'));
      });

      await expect(
        service.createChannel(
          'UC123',
          'Fireship',
          'https://youtube.com/@fireship',
          '',
          true,
        ),
      ).rejects.toThrow(
        new InternalServerErrorException(
          'Channel created but failed to fetch details',
        ),
      );
    });
  });
});

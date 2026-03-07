import { DatabaseService } from '@libs/database';
import { Test, TestingModule } from '@nestjs/testing';
import { TelegramSubmissionService, TelegramSubmissionData, TelegramSubmissionRecord } from './telegram-submission.service';

describe('TelegramSubmissionService', () => {
  let service: TelegramSubmissionService;

  // Mock database connection
  const mockDbConnection = {
    all: jest.fn(),
    get: jest.fn(),
    run: jest.fn(),
    prepare: jest.fn(),
    close: jest.fn(),
    serialize: jest.fn(),
  };

  beforeEach(async () => {
    const mockDatabaseService = {
      getDbConnection: jest.fn().mockReturnValue(mockDbConnection),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramSubmissionService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<TelegramSubmissionService>(TelegramSubmissionService);
    // Clear mocks
    mockDbConnection.all.mockClear();
    mockDbConnection.get.mockClear();
    mockDbConnection.run.mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSubmission', () => {
    it('should create a submission record successfully', async () => {
      const submissionId = '550e8400-e29b-41d4-a716-446655440000';
      mockDbConnection.get.mockImplementation((query, values, callback) => {
        callback(null, { id: submissionId });
      });

      const data: TelegramSubmissionData = {
        chatId: '123456789',
        username: 'testuser',
        messageId: '456',
        messageText: 'Test message',
        feedProfile: 'technology',
        url: 'https://example.com/article',
        submissionStatus: 'pending',
      };

      const result = await service.createSubmission(data);

      expect(result).toBe(submissionId);
      expect(mockDbConnection.get).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO telegram_submissions'),
        expect.arrayContaining([
          null, // article_id
          data.chatId,
          data.username,
          data.messageId,
          data.messageText,
          data.feedProfile,
          data.url,
          data.submissionStatus,
          null, // error_message
        ]),
        expect.any(Function),
      );
    });

    it('should handle optional fields being undefined', async () => {
      const submissionId = '550e8400-e29b-41d4-a716-446655440000';
      mockDbConnection.get.mockImplementation((query, values, callback) => {
        callback(null, { id: submissionId });
      });

      const data: TelegramSubmissionData = {
        chatId: '123456789',
        messageId: '456',
        feedProfile: 'technology',
        url: 'https://example.com/article',
        submissionStatus: 'pending',
      };

      const result = await service.createSubmission(data);

      expect(result).toBe(submissionId);
      expect(mockDbConnection.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          null, // article_id
          data.chatId,
          null, // username
          data.messageId,
          null, // message_text
          data.feedProfile,
          data.url,
          data.submissionStatus,
          null, // error_message
        ]),
        expect.any(Function),
      );
    });

    it('should reject on database error', async () => {
      mockDbConnection.get.mockImplementation((query, values, callback) => {
        callback(new Error('Database error'), null);
      });

      const data: TelegramSubmissionData = {
        chatId: '123456789',
        messageId: '456',
        feedProfile: 'technology',
        url: 'https://example.com/article',
        submissionStatus: 'pending',
      };

      await expect(service.createSubmission(data)).rejects.toThrow('Database error');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        chatId: '', // Empty string
        messageId: '456',
        feedProfile: 'technology',
        url: 'https://example.com/article',
        submissionStatus: 'pending',
      } as TelegramSubmissionData;

      await expect(service.createSubmission(invalidData)).rejects.toThrow('chatId is required');
    });
  });

  describe('updateSubmissionStatus', () => {
    it('should update submission status to success', async () => {
      mockDbConnection.run.mockImplementation((query, values, callback) => {
        callback(null);
      });

      const submissionId = '550e8400-e29b-41d4-a716-446655440000';
      const articleId = 'article-uuid';

      await service.updateSubmissionStatus(submissionId, 'success', { articleId });

      expect(mockDbConnection.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE telegram_submissions'),
        ['success', articleId, null, submissionId],
        expect.any(Function),
      );
    });

    it('should update submission status to failed with error message', async () => {
      mockDbConnection.run.mockImplementation((query, values, callback) => {
        callback(null);
      });

      const submissionId = '550e8400-e29b-41d4-a716-446655440000';
      const errorMessage = 'Failed to scrape article';

      await service.updateSubmissionStatus(submissionId, 'failed', { errorMessage });

      expect(mockDbConnection.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE telegram_submissions'),
        ['failed', null, errorMessage, submissionId],
        expect.any(Function),
      );
    });

    it('should reject on database error', async () => {
      mockDbConnection.run.mockImplementation((query, values, callback) => {
        callback(new Error('Update failed'));
      });

      await expect(
        service.updateSubmissionStatus('id', 'success', { articleId: 'article' }),
      ).rejects.toThrow('Update failed');
    });

    it('should validate submission ID', async () => {
      await expect(
        service.updateSubmissionStatus('', 'success'),
      ).rejects.toThrow('submissionId is required');
    });

    it('should validate status value', async () => {
      await expect(
        service.updateSubmissionStatus('id', 'invalid' as any),
      ).rejects.toThrow('Invalid status value');
    });
  });

  describe('getSubmissionById', () => {
    it('should return submission by id', async () => {
      const dbRow = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        article_id: 'article-uuid',
        chat_id: '123456789',
        username: 'testuser',
        message_id: '456',
        message_text: 'Test message',
        feed_profile: 'technology',
        url: 'https://example.com/article',
        submission_status: 'success',
        error_message: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const expectedRecord: TelegramSubmissionRecord = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        articleId: 'article-uuid',
        chatId: '123456789',
        username: 'testuser',
        messageId: '456',
        messageText: 'Test message',
        feedProfile: 'technology',
        url: 'https://example.com/article',
        submissionStatus: 'success',
        errorMessage: null,
        createdAt: dbRow.created_at,
        updatedAt: dbRow.updated_at,
      };

      mockDbConnection.get.mockImplementation((query, values, callback) => {
        callback(null, dbRow);
      });

      const result = await service.getSubmissionById(dbRow.id);

      expect(result).toEqual(expectedRecord);
    });

    it('should return null when submission not found', async () => {
      mockDbConnection.get.mockImplementation((query, values, callback) => {
        callback(null, undefined);
      });

      const result = await service.getSubmissionById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should validate submission ID', async () => {
      await expect(service.getSubmissionById('')).rejects.toThrow('submissionId is required');
    });
  });

  describe('getSubmissionsByChatId', () => {
    it('should return submissions for a chat', async () => {
      const dbRows = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          chat_id: '123456789',
          submission_status: 'success',
          article_id: null,
          username: null,
          message_id: '123',
          message_text: null,
          feed_profile: 'tech',
          url: 'https://example.com',
          error_message: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          chat_id: '123456789',
          submission_status: 'failed',
          article_id: null,
          username: null,
          message_id: '124',
          message_text: null,
          feed_profile: 'tech',
          url: 'https://example.com',
          error_message: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, dbRows);
      });

      const result = await service.getSubmissionsByChatId('123456789');

      expect(result).toHaveLength(2);
      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE chat_id = ?'),
        ['123456789', 100, 0],
        expect.any(Function),
      );
    });

    it('should return empty array when no submissions found', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, null);
      });

      const result = await service.getSubmissionsByChatId('unknown-chat');

      expect(result).toEqual([]);
    });

    it('should validate chat ID', async () => {
      await expect(service.getSubmissionsByChatId('')).rejects.toThrow('chatId is required');
    });

    it('should accept custom limit and offset', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, []);
      });

      await service.getSubmissionsByChatId('123456789', { limit: 50, offset: 10 });

      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE chat_id = ?'),
        ['123456789', 50, 10],
        expect.any(Function),
      );
    });
  });

  describe('getRecentSubmissions', () => {
    it('should return recent submissions with default limit', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, []);
      });

      await service.getRecentSubmissions();

      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [100],
        expect.any(Function),
      );
    });

    it('should filter by status', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, []);
      });

      await service.getRecentSubmissions({ status: 'success', limit: 50 });

      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('submission_status = ?'),
        ['success', 50],
        expect.any(Function),
      );
    });

    it('should filter by date range', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, []);
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      await service.getRecentSubmissions({ startDate, endDate });

      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('created_at >= ? AND created_at <= ?'),
        [startDate, endDate, 100],
        expect.any(Function),
      );
    });
  });

  describe('getSubmissionStats', () => {
    it('should return aggregated stats', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, [
          { submission_status: 'success', count: '10' },
          { submission_status: 'failed', count: '2' },
          { submission_status: 'duplicate', count: '3' },
          { submission_status: 'pending', count: '1' },
        ]);
      });

      const result = await service.getSubmissionStats();

      expect(result).toEqual({
        total: 16,
        success: 10,
        failed: 2,
        duplicate: 3,
        pending: 1,
      });
    });

    it('should handle empty results', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, []);
      });

      const result = await service.getSubmissionStats();

      expect(result).toEqual({
        total: 0,
        success: 0,
        failed: 0,
        duplicate: 0,
        pending: 0,
      });
    });

    it('should handle null results', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, null);
      });

      const result = await service.getSubmissionStats();

      expect(result).toEqual({
        total: 0,
        success: 0,
        failed: 0,
        duplicate: 0,
        pending: 0,
      });
    });

    it('should handle invalid count values', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, [
          { submission_status: 'success', count: 'invalid' },
          { submission_status: 'failed', count: '2' },
        ]);
      });

      const result = await service.getSubmissionStats();

      // Should skip invalid count and only count valid ones
      expect(result.total).toBe(2);
      expect(result.failed).toBe(2);
      expect(result.success).toBe(0);
    });
  });

  describe('deleteOldSubmissions', () => {
    it('should delete submissions before given date', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, [{ id: '1' }, { id: '2' }]);
      });

      const beforeDate = new Date('2024-01-01');
      const result = await service.deleteOldSubmissions(beforeDate);

      expect(result).toBe(2);
      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM telegram_submissions'),
        [beforeDate],
        expect.any(Function),
      );
    });

    it('should return 0 when no submissions deleted', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, null);
      });

      const result = await service.deleteOldSubmissions(new Date());

      expect(result).toBe(0);
    });

    it('should validate beforeDate', async () => {
      await expect(service.deleteOldSubmissions(null as any)).rejects.toThrow('Valid beforeDate is required');
    });
  });

  describe('anonymizeSubmissionsByUsername', () => {
    it('should anonymize submissions for a username', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, [{ id: '1' }, { id: '2' }, { id: '3' }]);
      });

      const result = await service.anonymizeSubmissionsByUsername('testuser');

      expect(result).toBe(3);
      expect(mockDbConnection.all).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE telegram_submissions'),
        ['testuser'],
        expect.any(Function),
      );
    });

    it('should return 0 when no submissions anonymized', async () => {
      mockDbConnection.all.mockImplementation((query, values, callback) => {
        callback(null, []);
      });

      const result = await service.anonymizeSubmissionsByUsername('unknown');

      expect(result).toBe(0);
    });

    it('should validate username', async () => {
      await expect(service.anonymizeSubmissionsByUsername('')).rejects.toThrow('username is required');
    });
  });
});
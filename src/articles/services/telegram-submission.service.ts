import { DatabaseService, SqlParams } from '@libs/database';
import { BadRequestException, Injectable } from '@nestjs/common';

export interface TelegramSubmissionData {
  articleId?: string | null;
  chatId: string;
  username?: string;
  messageId: string;
  messageText?: string;
  feedProfile: string;
  url: string;
  submissionStatus: 'pending' | 'success' | 'failed' | 'duplicate';
  errorMessage?: string;
}

export interface TelegramSubmissionRecord {
  id: string;
  articleId: string | null;
  chatId: string;
  username: string | null;
  messageId: string;
  messageText: string | null;
  feedProfile: string;
  url: string;
  submissionStatus: 'pending' | 'success' | 'failed' | 'duplicate';
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const VALID_SUBMISSION_STATUSES = ['pending', 'success', 'failed', 'duplicate'] as const;
type SubmissionStatus = (typeof VALID_SUBMISSION_STATUSES)[number];

interface TelegramSubmissionDbRow {
  id: string;
  article_id: string | null;
  chat_id: string;
  username: string | null;
  message_id: string;
  message_text: string | null;
  feed_profile: string;
  url: string;
  submission_status: string;
  error_message: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

function parseSubmissionStatus(value: string): SubmissionStatus {
  const status = VALID_SUBMISSION_STATUSES.find((s) => s === value);
  return status ?? 'pending';
}

@Injectable()
export class TelegramSubmissionService {
  constructor(private readonly databaseService: DatabaseService) { }

  private validateSubmissionData(data: TelegramSubmissionData): void {
    if (!data.chatId || data.chatId.trim() === '') {
      throw new BadRequestException('chatId is required');
    }
    if (!data.messageId || data.messageId.trim() === '') {
      throw new BadRequestException('messageId is required');
    }
    if (!data.feedProfile || data.feedProfile.trim() === '') {
      throw new BadRequestException('feedProfile is required');
    }
    if (!data.url || data.url.trim() === '') {
      throw new BadRequestException('url is required');
    }
    if (!data.submissionStatus) {
      throw new BadRequestException('submissionStatus is required');
    }
    if (!['pending', 'success', 'failed', 'duplicate'].includes(data.submissionStatus)) {
      throw new BadRequestException('Invalid submissionStatus');
    }
  }

  private validateSubmissionId(submissionId: string): void {
    if (!submissionId || submissionId.trim() === '') {
      throw new BadRequestException('submissionId is required');
    }
  }

  private validateChatId(chatId: string): void {
    if (!chatId || chatId.trim() === '') {
      throw new BadRequestException('chatId is required');
    }
  }

  private getDbConnection() {
    const db = this.databaseService.getDbConnection();
    if (!db) {
      throw new Error('Database connection not available. Call initDb() first.');
    }
    return db;
  }

  private promisifyDbOperation<T>(
    operation: (callback: (err: Error | null, result?: T) => void) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      operation((err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result as T);
        }
      });
    });
  }

  async createSubmission(data: TelegramSubmissionData): Promise<string> {
    this.validateSubmissionData(data);

    const db = this.getDbConnection();

    const query = `
      INSERT INTO telegram_submissions (
        article_id,
        chat_id,
        username,
        message_id,
        message_text,
        feed_profile,
        url,
        submission_status,
        error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `;

    const values = [
      data.articleId || null,
      data.chatId,
      data.username || null,
      data.messageId,
      data.messageText || null,
      data.feedProfile,
      data.url,
      data.submissionStatus,
      data.errorMessage || null,
    ];

    const row = await this.promisifyDbOperation<{ id: string } | undefined>((callback) => {
      db.get(query, values, callback);
    });

    if (!row?.id) {
      throw new Error('Failed to create submission record');
    }
    return row.id;
  }

  async updateSubmissionStatus(
    submissionId: string,
    status: 'pending' | 'success' | 'failed' | 'duplicate',
    options?: {
      articleId?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    this.validateSubmissionId(submissionId);

    if (!['pending', 'success', 'failed', 'duplicate'].includes(status)) {
      throw new BadRequestException('Invalid status value');
    }

    const db = this.getDbConnection();

    const query = `
      UPDATE telegram_submissions
      SET
        submission_status = ?,
        article_id = COALESCE(?, article_id),
        error_message = COALESCE(?, error_message),
        updated_at = NOW()
      WHERE id = ?
    `;

    const values = [
      status,
      options?.articleId || null,
      options?.errorMessage || null,
      submissionId,
    ];

    await this.promisifyDbOperation<void>((callback) => {
      db.run(query, values, callback);
    });
  }

  async getSubmissionById(submissionId: string): Promise<TelegramSubmissionRecord | null> {
    this.validateSubmissionId(submissionId);

    const db = this.getDbConnection();

    const query = `
      SELECT *
      FROM telegram_submissions
      WHERE id = ?
    `;

    const row = await this.promisifyDbOperation<TelegramSubmissionDbRow | undefined>((callback) => {
      db.get(query, [submissionId], callback);
    });

    if (!row) {
      return null;
    }

    return this.mapDbRowToRecord(row);
  }

  async getSubmissionsByChatId(
    chatId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<TelegramSubmissionRecord[]> {
    this.validateChatId(chatId);

    const db = this.getDbConnection();

    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const query = `
      SELECT *
      FROM telegram_submissions
      WHERE chat_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await this.promisifyDbOperation<TelegramSubmissionDbRow[]>((callback) => {
      db.all(query, [chatId, limit, offset], callback);
    });

    return (rows || []).map(this.mapDbRowToRecord);
  }

  async getRecentSubmissions(options?: {
    limit?: number;
    status?: 'pending' | 'success' | 'failed' | 'duplicate';
    startDate?: Date;
    endDate?: Date;
  }): Promise<TelegramSubmissionRecord[]> {
    const db = this.getDbConnection();

    const conditions: string[] = [];
    const values: SqlParams = [];

    if (options?.status) {
      conditions.push('submission_status = ?');
      values.push(options.status);
    }

    if (options?.startDate) {
      conditions.push('created_at >= ?');
      values.push(options.startDate);
    }

    if (options?.endDate) {
      conditions.push('created_at <= ?');
      values.push(options.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 100;
    values.push(limit);

    const query = `
      SELECT *
      FROM telegram_submissions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const rows = await this.promisifyDbOperation<TelegramSubmissionDbRow[]>((callback) => {
      db.all(query, values, callback);
    });

    return (rows || []).map(this.mapDbRowToRecord);
  }

  async getSubmissionStats(options?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<{
    total: number;
    success: number;
    failed: number;
    duplicate: number;
    pending: number;
  }> {
    const db = this.getDbConnection();

    const conditions: string[] = [];
    const values: SqlParams = [];

    if (options?.startDate) {
      conditions.push('created_at >= ?');
      values.push(options.startDate);
    }

    if (options?.endDate) {
      conditions.push('created_at <= ?');
      values.push(options.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        submission_status,
        COUNT(*) as count
      FROM telegram_submissions
      ${whereClause}
      GROUP BY submission_status
    `;

    const rows = await this.promisifyDbOperation<{ submission_status: string; count: string | number }[]>((callback) => {
      db.all(query, values, callback);
    });

    const stats = {
      total: 0,
      success: 0,
      failed: 0,
      duplicate: 0,
      pending: 0,
    };

    if (rows) {
      for (const row of rows) {
        const count = typeof row.count === 'number'
          ? row.count
          : (parseInt(String(row.count), 10) || 0);

        if (isNaN(count)) continue;

        stats.total += count;
        switch (row.submission_status) {
          case 'success':
            stats.success += count;
            break;
          case 'failed':
            stats.failed += count;
            break;
          case 'duplicate':
            stats.duplicate += count;
            break;
          case 'pending':
            stats.pending += count;
            break;
        }
      }
    }

    return stats;
  }

  async deleteOldSubmissions(beforeDate: Date): Promise<number> {
    if (!beforeDate || !(beforeDate instanceof Date)) {
      throw new BadRequestException('Valid beforeDate is required');
    }

    const db = this.getDbConnection();

    const query = `
      DELETE FROM telegram_submissions
      WHERE created_at < ?
      RETURNING id
    `;

    const rows = await this.promisifyDbOperation<{ id: string }[]>((callback) => {
      db.all(query, [beforeDate], callback);
    });

    return rows?.length || 0;
  }

  async anonymizeSubmissionsByUsername(username: string): Promise<number> {
    if (!username || username.trim() === '') {
      throw new BadRequestException('username is required');
    }

    const db = this.getDbConnection();

    const query = `
      UPDATE telegram_submissions
      SET
        username = '[anonymized]',
        message_text = '[redacted]',
        updated_at = NOW()
      WHERE username = ?
      RETURNING id
    `;

    const rows = await this.promisifyDbOperation<{ id: string }[]>((callback) => {
      db.all(query, [username], callback);
    });

    return rows?.length || 0;
  }

  private mapDbRowToRecord(row: TelegramSubmissionDbRow): TelegramSubmissionRecord {
    return {
      id: row.id,
      articleId: row.article_id,
      chatId: row.chat_id,
      username: row.username,
      messageId: row.message_id,
      messageText: row.message_text,
      feedProfile: row.feed_profile,
      url: row.url,
      submissionStatus: parseSubmissionStatus(row.submission_status),
      errorMessage: row.error_message,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

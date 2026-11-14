import { DatabaseService, queryOne } from '@libs/database';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { User } from './user.entity';

interface UserRow {
  id: string;
  email: string;
  username: string;
  password?: string;
  is_email_verified: boolean;
  created_at: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getUserById(id: string): Promise<User | null> {
    const db = this.databaseService.getDbConnection();

    const row = await queryOne<UserRow>(
      db,
      `SELECT id, email, username, created_at FROM users WHERE id = ?`,
      [id],
    ).catch((err: unknown) => {
      console.error('Error fetching user by id:', err);
      throw new InternalServerErrorException('Failed to fetch user');
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      isEmailVerified: row.is_email_verified,
      created_at: new Date(row.created_at),
    };
  }

  async getUserByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    const db = this.databaseService.getDbConnection();

    const fields = includePassword
      ? 'id, email, username, is_email_verified, password, created_at'
      : 'id, email, username, is_email_verified, created_at';

    const row = await queryOne<UserRow>(
      db,
      `SELECT ${fields} FROM users WHERE email = ?`,
      [email],
    ).catch((err: unknown) => {
      console.error('Error fetching user by email:', err);
      throw new InternalServerErrorException('Failed to fetch user');
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      isEmailVerified: row.is_email_verified,
      ...(includePassword && row.password ? { password: row.password } : {}),
      created_at: new Date(row.created_at),
    };
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const db = this.databaseService.getDbConnection();

    const row = await queryOne<UserRow>(
      db,
      `SELECT id, email, username, created_at FROM users WHERE username = ?`,
      [username],
    ).catch((err: unknown) => {
      console.error('Error fetching user by username:', err);
      throw new InternalServerErrorException('Failed to fetch user');
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      isEmailVerified: row.is_email_verified,
      created_at: new Date(row.created_at),
    };
  }
}

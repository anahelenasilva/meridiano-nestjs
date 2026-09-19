import { DatabaseService, execute, queryOne } from '@libs/database';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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

  async createUser(
    email: string,
    username: string,
    password: string,
  ): Promise<User> {
    const hashedPassword = await this.hashPassword(password);
    const db = this.databaseService.getDbConnection();

    await execute(
      db,
      `
        INSERT INTO users (email, username, password)
        VALUES (?, ?, ?)
        RETURNING id, email, username, created_at
      `,
      [email, username, hashedPassword],
    ).catch((err: unknown) => {
      const errorWithCode = err as Error & { code?: string; detail?: string };

      if (
        errorWithCode.message.includes('duplicate key value') ||
        errorWithCode.code === '23505'
      ) {
        // Determine which field caused the conflict
        const errorDetail = errorWithCode.detail || errorWithCode.message;

        if (errorDetail.includes('email')) {
          throw new ConflictException('Email already exists');
        }
        if (errorDetail.includes('username')) {
          throw new ConflictException('Username already exists');
        }
        throw new ConflictException(
          'User with this email or username already exists',
        );
      }

      console.error('Error creating user:', err);
      throw new InternalServerErrorException(
        'Failed to create user. Please try again.',
      );
    });

    // Separate .catch so a read failure after a successful insert is not
    // reported as a failed create.
    const row = await queryOne<UserRow>(
      db,
      `SELECT id, email, username, created_at FROM users WHERE email = ?`,
      [email],
    ).catch((err: unknown) => {
      console.error('Error fetching created user:', err);
      throw new InternalServerErrorException(
        'User created but failed to fetch details',
      );
    });

    if (!row) {
      throw new InternalServerErrorException('User not found after creation');
    }

    return {
      id: row.id,
      email: row.email,
      username: row.username,
      isEmailVerified: row.is_email_verified,
      created_at: new Date(row.created_at),
    };
  }

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

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async updateUserPassword(userId: string, password: string): Promise<void> {
    const hashedPassword = await this.hashPassword(password);
    const db = this.databaseService.getDbConnection();

    await execute(db, `UPDATE users SET password = ? WHERE id = ?`, [
      hashedPassword,
      userId,
    ]).catch((err: unknown) => {
      console.error('Error updating user password:', err);
      throw new InternalServerErrorException('Failed to update password');
    });
  }
}

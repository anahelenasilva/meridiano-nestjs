import { DatabaseService } from '@libs/database';
import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

interface UserRow {
  id: string;
  email: string;
  username: string;
  password?: string;
  created_at: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) { }

  async createUser(email: string, username: string, password: string): Promise<User> {
    const hashedPassword = await this.hashPassword(password);

    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.run(
        `
        INSERT INTO users (email, username, password)
        VALUES (?, ?, ?)
        RETURNING id, email, username, created_at
      `,
        [email, username, hashedPassword],
        (err: Error | null) => {
          if (err) {
            const errorWithCode = err as Error & { code?: string; detail?: string };

            if (
              err.message.includes('duplicate key value') ||
              errorWithCode.code === '23505'
            ) {
              // Determine which field caused the conflict
              const errorDetail = errorWithCode.detail || err.message;

              if (errorDetail.includes('email')) {
                reject(new ConflictException('Email already exists'));
              } else if (errorDetail.includes('username')) {
                reject(new ConflictException('Username already exists'));
              } else {
                reject(new ConflictException('User with this email or username already exists'));
              }
            } else {
              console.error('Error creating user:', err);
              reject(new InternalServerErrorException('Failed to create user. Please try again.'));
            }
          } else {
            db.get(
              `SELECT id, email, username, created_at FROM users WHERE email = ?`,
              [email],
              (getErr: Error | null, row?: UserRow) => {
                if (getErr) {
                  console.error('Error fetching created user:', getErr);
                  reject(new InternalServerErrorException('User created but failed to fetch details'));
                } else if (!row) {
                  reject(new InternalServerErrorException('User not found after creation'));
                } else {
                  resolve({
                    id: row.id,
                    email: row.email,
                    username: row.username,
                    created_at: new Date(row.created_at),
                  });
                }
              },
            );
          }
        },
      );
    });
  }

  async getUserById(id: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.get(
        `SELECT id, email, username, created_at FROM users WHERE id = ?`,
        [id],
        (err: Error | null, row?: UserRow) => {
          if (err) {
            console.error('Error fetching user by id:', err);
            reject(new InternalServerErrorException('Failed to fetch user'));
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              email: row.email,
              username: row.username,
              created_at: new Date(row.created_at),
            });
          }
        },
      );
    });
  }

  async getUserByEmail(email: string, includePassword = false): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      const fields = includePassword
        ? 'id, email, username, password, created_at'
        : 'id, email, username, created_at';

      db.get(
        `SELECT ${fields} FROM users WHERE email = ?`,
        [email],
        (err: Error | null, row?: UserRow) => {
          if (err) {
            console.error('Error fetching user by email:', err);
            reject(new InternalServerErrorException('Failed to fetch user'));
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              email: row.email,
              username: row.username,
              ...(includePassword && row.password ? { password: row.password } : {}),
              created_at: new Date(row.created_at),
            });
          }
        },
      );
    });
  }

  async getUserByUsername(username: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.get(
        `SELECT id, email, username, created_at FROM users WHERE username = ?`,
        [username],
        (err: Error | null, row?: UserRow) => {
          if (err) {
            console.error('Error fetching user by username:', err);
            reject(new InternalServerErrorException('Failed to fetch user'));
          } else if (!row) {
            resolve(null);
          } else {
            resolve({
              id: row.id,
              email: row.email,
              username: row.username,
              created_at: new Date(row.created_at),
            });
          }
        },
      );
    });
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

    return new Promise((resolve, reject) => {
      const db = this.databaseService.getDbConnection();

      db.run(
        `UPDATE users SET password = ? WHERE id = ?`,
        [hashedPassword, userId],
        (err: Error | null) => {
          if (err) {
            console.error('Error updating user password:', err);
            reject(new InternalServerErrorException('Failed to update password'));
          } else {
            resolve();
          }
        },
      );
    });
  }
}

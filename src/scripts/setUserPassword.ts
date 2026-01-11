#!/usr/bin/env ts-node
/**
 * Script to set a password for a user
 *
 * Usage:
 *   ts-node src/scripts/setUserPassword.ts <email> <password>
 *
 * Example:
 *   ts-node src/scripts/setUserPassword.ts user@example.com mypassword123
 */

import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';

dotenv.config();

async function setUserPassword() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: ts-node src/scripts/setUserPassword.ts <email> <password>');
    console.error('Example: ts-node src/scripts/setUserPassword.ts user@example.com mypassword123');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Error: Password must be at least 6 characters long');
    process.exit(1);
  }

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'],
    });

    const usersService = app.get(UsersService);

    // Check if user exists
    const user = await usersService.getUserByEmail(email);
    if (!user) {
      console.error(`Error: User with email "${email}" not found`);
      await app.close();
      process.exit(1);
    }

    // Update password
    await usersService.updateUserPassword(user.id, password);

    console.log(`✅ Password successfully updated for user: ${email}`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);

    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Error updating password:', error);
    process.exit(1);
  }
}

void setUserPassword();

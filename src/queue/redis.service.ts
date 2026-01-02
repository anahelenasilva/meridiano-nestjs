import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor() {
    // Initialize Redis client immediately in constructor so it's available
    // when Queue providers are created during module initialization
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;

    console.log(`[RedisService] Constructor - Environment check:`);
    console.log(`  REDIS_HOST from env: ${process.env.REDIS_HOST || 'NOT SET (will default to localhost)'}`);
    console.log(`  REDIS_PORT from env: ${process.env.REDIS_PORT || 'NOT SET (will default to 6379)'}`);
    console.log(`  REDIS_PASSWORD from env: ${process.env.REDIS_PASSWORD ? 'SET' : 'NOT SET'}`);
    console.log(`[RedisService] Initializing Redis client - Connecting to ${redisHost}:${redisPort}`);

    this.client = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      maxRetriesPerRequest: null,
    });

    this.client.on('error', (error) => {
      console.error('[RedisService] Redis connection error:', error);
    });

    this.client.on('connect', () => {
      console.log('[RedisService] Redis connected successfully');
    });
  }

  onModuleInit() {
    // Client is already initialized in constructor
    // This hook can be used for additional setup if needed
    console.log('[RedisService] onModuleInit - Redis client ready');
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  getClient(): Redis {
    return this.client;
  }
}

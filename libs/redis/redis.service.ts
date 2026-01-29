import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  constructor() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;

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

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private errorHandler?: (error: Error) => void;
  private connectHandler?: () => void;

  constructor() { }

  onModuleInit() {
    const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;

    console.log(`[RedisService] Initializing Redis client - Using Redis URL: ${redisUrl}`);

    if (redisUrl) {
      console.log(`[RedisService] Initializing Redis client - Using Redis URL`);
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
      });
    } else {
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
    }

    this.errorHandler = (error: Error) => {
      console.error('[RedisService] Redis connection error:', error);
    };

    this.connectHandler = () => {
      console.log('[RedisService] Redis connected successfully');
    };

    this.client.on('error', this.errorHandler);
    this.client.on('connect', this.connectHandler);

    console.log('[RedisService] onModuleInit - Redis client ready');
  }

  async onModuleDestroy() {
    if (this.client) {
      if (this.errorHandler) {
        this.client.removeListener('error', this.errorHandler);
      }
      if (this.connectHandler) {
        this.client.removeListener('connect', this.connectHandler);
      }
      try {
        await this.client.quit();
      } catch (error) {
        console.error('[RedisService] Error quitting Redis client:', error);
        this.client.disconnect();
      }
    }
  }

  getClient(): Redis {
    return this.client;
  }
}

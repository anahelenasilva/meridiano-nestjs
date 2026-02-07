import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private errorHandler?: (error: Error) => void;
  private connectHandler?: () => void;

  constructor() { }

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;

    if (redisUrl) {
      console.log(`[RedisService] Initializing Redis client - Using Redis URL: ${redisUrl}`);

      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        connectTimeout: 10000,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          if (times <= 3) {
            console.log(`[RedisService] Retrying connection in ${delay}ms (attempt ${times})`);
          }
          return delay;
        },
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
        enableReadyCheck: true,
        connectTimeout: 10000,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          if (times <= 3) {
            console.log(`[RedisService] Retrying connection in ${delay}ms (attempt ${times})`);
          }
          return delay;
        },
      });
    }

    this.errorHandler = (error: Error) => {
      if (error.message?.includes('ECONNREFUSED') && error.message?.includes('127.0.0.1')) {
        console.warn('[RedisService] Connection refused to localhost - this may be from BullMQ retries. Redis should connect via URL.');
        return;
      }
      console.error('[RedisService] Redis connection error:', error.message || error);
    };

    this.connectHandler = () => {
      console.log('[RedisService] Redis connected successfully');
    };

    this.client.on('error', this.errorHandler);
    this.client.on('connect', this.connectHandler);

    try {
      await this.client.ping();
      console.log('[RedisService] Redis ping successful - client ready');
    } catch (error) {
      console.warn('[RedisService] Redis ping failed, but client will retry:', error instanceof Error ? error.message : error);
    }
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

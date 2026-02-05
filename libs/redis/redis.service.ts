import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private errorHandler?: (error: Error) => void;
  private connectHandler?: () => void;
  private redisHost: string;
  private redisPort: number;
  private redisPassword: string | undefined;

  constructor() {
    this.redisHost = process.env.REDIS_HOST || 'localhost';
    this.redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    this.redisPassword = process.env.REDIS_PASSWORD || undefined;
  }

  onModuleInit() {
    console.log(`[RedisService] Initializing Redis client - Connecting to ${this.redisHost}:${this.redisPort}`);

    this.client = new Redis({
      host: this.redisHost,
      port: this.redisPort,
      password: this.redisPassword,
      maxRetriesPerRequest: null,
    });

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

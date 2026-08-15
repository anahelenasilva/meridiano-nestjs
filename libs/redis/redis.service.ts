import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../../src/config/config.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;
  private errorHandler?: (error: Error) => void;
  private connectHandler?: () => void;

  constructor(private readonly configService: ConfigService) {
    this.client = this.createClient();
  }

  async onModuleInit() {
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

  private createClient(): Redis {
    const { url, host, port, password } = this.configService.getRedisConfig();

    if (url) {
      console.log('[RedisService] Initializing Redis client - Using Redis URL');
      return new Redis(url, {
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

    console.log(`[RedisService] Initializing Redis client - Connecting to ${host}:${port}`);

    return new Redis({
      host,
      port,
      password,
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
}

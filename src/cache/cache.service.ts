import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger = new Logger(CacheService.name);

  // Key prefixes — keeps cache keys predictable and easy to invalidate by pattern
  private readonly APPEAL_PREFIX = 'appeal:';
  private readonly USER_APPEALS_PREFIX = 'user_appeals:';

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
      // Don't crash the app if Redis is temporarily unavailable
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    // Prevent application from crashing if Redis is not available
    this.redis.on('error', (err) => {
      this.logger.error('Redis Error', err);
    });
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
      this.logger.log('Redis connected');
    } catch (error) {
      this.logger.warn(
        'Redis connection failed — cache will be unavailable',
        error,
      );
    }
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async getAppeal(appealId: string): Promise<string | null> {
    return this.safeGet(this.APPEAL_PREFIX + appealId);
  }

  async setAppeal(
    appealId: string,
    data: unknown,
    ttlSeconds = 300,
  ): Promise<void> {
    await this.safeSet(
      this.APPEAL_PREFIX + appealId,
      JSON.stringify(data),
      ttlSeconds,
    );
  }

  async getUserAppeals(userId: string): Promise<string | null> {
    return this.safeGet(this.USER_APPEALS_PREFIX + userId);
  }

  async setUserAppeals(
    userId: string,
    data: unknown,
    ttlSeconds = 120,
  ): Promise<void> {
    await this.safeSet(
      this.USER_APPEALS_PREFIX + userId,
      JSON.stringify(data),
      ttlSeconds,
    );
  }

  // When an appeal is updated, invalidate both the appeal itself
  // and the user's appeal list so stale data isn't served
  async invalidateAppeal(appealId: string, userId: string): Promise<void> {
    await Promise.all([
      this.redis.del(this.APPEAL_PREFIX + appealId),
      this.redis.del(this.USER_APPEALS_PREFIX + userId),
    ]);
  }

  private async safeGet(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.warn(`Cache get failed for key ${key}`, error);
      return null;
    }
  }

  private async safeSet(
    key: string,
    value: string,
    ttl: number,
  ): Promise<void> {
    try {
      await this.redis.set(key, value, 'EX', ttl);
    } catch (error) {
      this.logger.warn(`Cache set failed for key ${key}`, error);
    }
  }
}

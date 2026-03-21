import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

// We implement our own Redis wrapper instead of using @nestjs/cache-manager
// because it gives us explicit control over TTL, key patterns, and invalidation
@Module({
  imports: [ConfigModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}

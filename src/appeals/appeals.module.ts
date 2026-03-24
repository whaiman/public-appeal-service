import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appeal } from './entities/appeal.entity';
import { AppealsController } from './appeals.controller';
import { AppealsService } from './appeals.service';
import { AppealsRepository } from './appeals.repository';
import { AiModule } from '../ai/ai.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [TypeOrmModule.forFeature([Appeal]), AiModule, CacheModule],
  controllers: [AppealsController],
  providers: [AppealsService, AppealsRepository],
})
export class AppealsModule {}

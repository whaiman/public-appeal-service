import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { Appeal } from './appeals/entities/appeal.entity';
import { AuthModule } from './auth/auth.module';
import { AppealsModule } from './appeals/appeals.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { CacheModule } from './cache/cache.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [User, Appeal],
        synchronize: true, // only for development, migrations in production
      }),
    }),
    AuthModule,
    AppealsModule,
    UsersModule,
    AiModule,
    CacheModule,
  ],
})

export class AppModule {}
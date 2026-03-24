import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AppealsRepository } from './appeals.repository';
import { AiService } from '../ai/ai.service';
import { CacheService } from '../cache/cache.service';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { UpdateAppealStatusDto } from './dto/update-appeal.dto';
import { Appeal } from './entities/appeal.entity';
import { User, UserRole } from '../users/entities/user.entity';

@Injectable()
export class AppealsService {
  private readonly logger = new Logger(AppealsService.name);

  constructor(
    private readonly appealsRepository: AppealsRepository,
    private readonly aiService: AiService,
    private readonly cacheService: CacheService,
  ) {}

  async create(dto: CreateAppealDto, user: User): Promise<Appeal> {
    const analysis = await this.aiService.analyzeAppeal(
      dto.title,
      dto.description,
    );

    const appeal = await this.appealsRepository.create({
      title: dto.title,
      description: dto.description,
      userId: user.id,
      category: analysis.category,
      priority: analysis.priority,
      aiAnalysis: {
        reasoning: analysis.reasoning,
        estimatedResolutionDays: analysis.estimatedResolutionDays,
        analyzedAt: new Date().toISOString(),
      },
    });

    // Invalidate user's appeal list so next fetch reflects the new appeal
    await this.cacheService.invalidateAppeal('', user.id);

    this.logger.log(
      `Appeal ${appeal.id} created by user ${user.id} — priority: ${appeal.priority}`,
    );

    return appeal;
  }

  async findOne(id: string, requestingUser: User): Promise<Appeal> {
    const cached = await this.cacheService.getAppeal(id);

    if (cached) {
      const appeal: Appeal = JSON.parse(cached);
      this.assertAccess(appeal, requestingUser);
      return appeal;
    }

    const appeal = await this.appealsRepository.findById(id);

    if (!appeal) {
      throw new NotFoundException('Appeal not found');
    }

    this.assertAccess(appeal, requestingUser);

    await this.cacheService.setAppeal(id, appeal);

    return appeal;
  }

  async findMyAppeals(user: User): Promise<Appeal[]> {
    const cached = await this.cacheService.getUserAppeals(user.id);

    if (cached) {
      return JSON.parse(cached);
    }

    const appeals = await this.appealsRepository.findByUserId(user.id);
    await this.cacheService.setUserAppeals(user.id, appeals);

    return appeals;
  }

  async findAll(): Promise<Appeal[]> {
    return this.appealsRepository.findAll();
  }

  async updateStatus(
    id: string,
    dto: UpdateAppealStatusDto,
    requestingUser: User,
  ): Promise<Appeal> {
    const appeal = await this.appealsRepository.findById(id);

    if (!appeal) {
      throw new NotFoundException('Appeal not found');
    }

    const updated = await this.appealsRepository.updateStatus(id, dto.status);

    await this.cacheService.invalidateAppeal(id, appeal.userId);

    this.logger.log(
      `Appeal ${id} status changed to ${dto.status} by admin ${requestingUser.id}`,
    );

    return updated!;
  }

  // Citizens can only access their own appeals
  private assertAccess(appeal: Appeal, user: User): void {
    if (user.role === UserRole.ADMIN) return;

    if (appeal.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
  }
}

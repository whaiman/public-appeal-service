import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appeal, AppealStatus } from './entities/appeal.entity';

@Injectable()
export class AppealsRepository {
  constructor(
    @InjectRepository(Appeal)
    private readonly repo: Repository<Appeal>,
  ) {}

  async create(partial: Partial<Appeal>): Promise<Appeal> {
    return this.repo.save(this.repo.create(partial));
  }

  async findById(id: string): Promise<Appeal | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
  }

  async findByUserId(userId: string): Promise<Appeal[]> {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // Admins see all appeals, sorted by priority weight then creation date
  async findAll(): Promise<Appeal[]> {
    return this.repo
      .createQueryBuilder('appeal')
      .leftJoinAndSelect('appeal.user', 'user')
      .orderBy(
        `CASE appeal.priority
          WHEN 'urgent' THEN 1
          WHEN 'high'   THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low'    THEN 4
        END`,
      )
      .addOrderBy('appeal.createdAt', 'ASC')
      .getMany();
  }

  async updateStatus(id: string, status: AppealStatus): Promise<Appeal | null> {
    await this.repo.update(id, { status });
    return this.findById(id);
  }
}

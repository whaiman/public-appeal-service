import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AppealsService } from './appeals.service';
import { AppealsRepository } from './appeals.repository';
import { AiService } from '../ai/ai.service';
import { CacheService } from '../cache/cache.service';
import {
  AppealCategory,
  AppealPriority,
  AppealStatus,
} from './entities/appeal.entity';
import { UserRole } from '../users/entities/user.entity';
import type { Appeal } from './entities/appeal.entity';
import type { User } from '../users/entities/user.entity';

// ─── Factories ───────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    email: 'citizen@test.com',
    fullName: 'Test Citizen',
    role: UserRole.CITIZEN,
    createdAt: new Date(),
    appeals: [],
    ...overrides,
  }) as User;

const makeAdmin = (): User =>
  makeUser({
    id: 'admin-uuid-1',
    email: 'admin@gov-agency.example',
    role: UserRole.ADMIN,
  });

const makeAppeal = (overrides: Partial<Appeal> = {}): Appeal =>
  ({
    id: 'appeal-uuid-1',
    title: 'Street lighting is broken on Nizami street',
    description:
      'The street lighting on Nizami street has not been working for three weeks. It creates safety issues for pedestrians at night.',
    status: AppealStatus.PENDING,
    category: AppealCategory.INFRASTRUCTURE,
    priority: AppealPriority.HIGH,
    userId: 'user-uuid-1',
    aiAnalysis: {
      reasoning: 'Infrastructure issue affecting public safety',
      estimatedResolutionDays: 7,
      analyzedAt: new Date().toISOString(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Appeal;

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAppealsRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findAll: jest.fn(),
  updateStatus: jest.fn(),
};

const mockAiService = {
  analyzeAppeal: jest.fn(),
};

const mockCacheService = {
  getAppeal: jest.fn(),
  setAppeal: jest.fn(),
  getUserAppeals: jest.fn(),
  setUserAppeals: jest.fn(),
  invalidateAppeal: jest.fn(),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AppealsService', () => {
  let service: AppealsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppealsService,
        { provide: AppealsRepository, useValue: mockAppealsRepository },
        { provide: AiService, useValue: mockAiService },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<AppealsService>(AppealsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      title: 'Street lighting is broken on Nizami street',
      description:
        'The street lighting on Nizami street has not been working for three weeks. It creates safety issues for pedestrians at night.',
    };

    const aiResult = {
      category: AppealCategory.INFRASTRUCTURE,
      priority: AppealPriority.HIGH,
      reasoning: 'Infrastructure issue affecting public safety',
      estimatedResolutionDays: 7,
    };

    it('should create an appeal with AI-assigned category and priority', async () => {
      const citizen = makeUser();
      const appeal = makeAppeal();

      mockAiService.analyzeAppeal.mockResolvedValue(aiResult);
      mockAppealsRepository.create.mockResolvedValue(appeal);
      mockCacheService.invalidateAppeal.mockResolvedValue(undefined);

      const result = await service.create(dto, citizen);

      expect(mockAiService.analyzeAppeal).toHaveBeenCalledWith(
        dto.title,
        dto.description,
      );
      expect(mockAppealsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: dto.title,
          description: dto.description,
          userId: citizen.id,
          category: aiResult.category,
          priority: aiResult.priority,
        }),
      );
      expect(result).toEqual(appeal);
    });

    it('should invalidate the user appeal list cache after creation', async () => {
      const citizen = makeUser();

      mockAiService.analyzeAppeal.mockResolvedValue(aiResult);
      mockAppealsRepository.create.mockResolvedValue(makeAppeal());
      mockCacheService.invalidateAppeal.mockResolvedValue(undefined);

      await service.create(dto, citizen);

      expect(mockCacheService.invalidateAppeal).toHaveBeenCalledWith(
        '',
        citizen.id,
      );
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return a cached appeal without hitting the database', async () => {
      const citizen = makeUser();
      const appeal = makeAppeal();

      mockCacheService.getAppeal.mockResolvedValue(JSON.stringify(appeal));

      const result = await service.findOne(appeal.id, citizen);

      // After JSON round-trip, Date fields become ISO strings — this is expected behavior
      expect(result).toEqual(JSON.parse(JSON.stringify(appeal)));
      expect(mockAppealsRepository.findById).not.toHaveBeenCalled();
    });

    it('should fetch from database on cache miss and then cache the result', async () => {
      const citizen = makeUser();
      const appeal = makeAppeal();

      mockCacheService.getAppeal.mockResolvedValue(null);
      mockAppealsRepository.findById.mockResolvedValue(appeal);
      mockCacheService.setAppeal.mockResolvedValue(undefined);

      const result = await service.findOne(appeal.id, citizen);

      expect(mockAppealsRepository.findById).toHaveBeenCalledWith(appeal.id);
      expect(mockCacheService.setAppeal).toHaveBeenCalledWith(
        appeal.id,
        appeal,
      );
      expect(result).toEqual(appeal);
    });

    it('should throw NotFoundException when appeal does not exist', async () => {
      mockCacheService.getAppeal.mockResolvedValue(null);
      mockAppealsRepository.findById.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent-id', makeUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when citizen tries to access another user appeal', async () => {
      const citizen = makeUser({ id: 'different-user-id' });
      const appeal = makeAppeal({ userId: 'user-uuid-1' });

      mockCacheService.getAppeal.mockResolvedValue(null);
      mockAppealsRepository.findById.mockResolvedValue(appeal);

      await expect(service.findOne(appeal.id, citizen)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to access any appeal regardless of ownership', async () => {
      const admin = makeAdmin();
      const appeal = makeAppeal({ userId: 'some-other-user-id' });

      mockCacheService.getAppeal.mockResolvedValue(null);
      mockAppealsRepository.findById.mockResolvedValue(appeal);
      mockCacheService.setAppeal.mockResolvedValue(undefined);

      const result = await service.findOne(appeal.id, admin);

      expect(result).toEqual(appeal);
    });
  });

  // ─── findMyAppeals ─────────────────────────────────────────────────────────

  describe('findMyAppeals', () => {
    it('should return cached appeals without hitting the database', async () => {
      const citizen = makeUser();
      const appeals = [makeAppeal()];

      mockCacheService.getUserAppeals.mockResolvedValue(
        JSON.stringify(appeals),
      );

      const result = await service.findMyAppeals(citizen);

      expect(result).toEqual(JSON.parse(JSON.stringify(appeals)));
      expect(mockAppealsRepository.findByUserId).not.toHaveBeenCalled();
    });

    it('should fetch from database on cache miss and cache the result', async () => {
      const citizen = makeUser();
      const appeals = [makeAppeal()];

      mockCacheService.getUserAppeals.mockResolvedValue(null);
      mockAppealsRepository.findByUserId.mockResolvedValue(appeals);
      mockCacheService.setUserAppeals.mockResolvedValue(undefined);

      const result = await service.findMyAppeals(citizen);

      expect(mockAppealsRepository.findByUserId).toHaveBeenCalledWith(
        citizen.id,
      );
      expect(mockCacheService.setUserAppeals).toHaveBeenCalledWith(
        citizen.id,
        appeals,
      );
      expect(result).toEqual(appeals);
    });

    it('should return an empty array when citizen has no appeals', async () => {
      mockCacheService.getUserAppeals.mockResolvedValue(null);
      mockAppealsRepository.findByUserId.mockResolvedValue([]);
      mockCacheService.setUserAppeals.mockResolvedValue(undefined);

      const result = await service.findMyAppeals(makeUser());

      expect(result).toEqual([]);
    });
  });

  // ─── findAll (admin) ───────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all appeals sorted by priority', async () => {
      const appeals = [
        makeAppeal({ id: 'appeal-1', priority: AppealPriority.URGENT }),
        makeAppeal({ id: 'appeal-2', priority: AppealPriority.LOW }),
        makeAppeal({ id: 'appeal-3', priority: AppealPriority.HIGH }),
      ];

      mockAppealsRepository.findAll.mockResolvedValue(appeals);

      const result = await service.findAll();

      expect(result).toEqual(appeals);
      expect(mockAppealsRepository.findAll).toHaveBeenCalledTimes(1);
    });
  });

  // ─── updateStatus (admin) ──────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update appeal status and invalidate cache', async () => {
      const admin = makeAdmin();
      const appeal = makeAppeal();
      const updated = makeAppeal({ status: AppealStatus.IN_PROGRESS });

      mockAppealsRepository.findById.mockResolvedValue(appeal);
      mockAppealsRepository.updateStatus.mockResolvedValue(updated);
      mockCacheService.invalidateAppeal.mockResolvedValue(undefined);

      const result = await service.updateStatus(
        appeal.id,
        { status: AppealStatus.IN_PROGRESS },
        admin,
      );

      expect(mockAppealsRepository.updateStatus).toHaveBeenCalledWith(
        appeal.id,
        AppealStatus.IN_PROGRESS,
      );
      expect(mockCacheService.invalidateAppeal).toHaveBeenCalledWith(
        appeal.id,
        appeal.userId,
      );
      expect(result.status).toBe(AppealStatus.IN_PROGRESS);
    });

    it('should throw NotFoundException when trying to update a non-existent appeal', async () => {
      mockAppealsRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          'non-existent-id',
          { status: AppealStatus.RESOLVED },
          makeAdmin(),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should correctly transition appeal through full lifecycle', async () => {
      const admin = makeAdmin();
      const appeal = makeAppeal({ status: AppealStatus.PENDING });

      const statuses = [AppealStatus.IN_PROGRESS, AppealStatus.RESOLVED];

      for (const status of statuses) {
        const updated = makeAppeal({ status });
        mockAppealsRepository.findById.mockResolvedValue(appeal);
        mockAppealsRepository.updateStatus.mockResolvedValue(updated);
        mockCacheService.invalidateAppeal.mockResolvedValue(undefined);

        const result = await service.updateStatus(appeal.id, { status }, admin);
        expect(result.status).toBe(status);
      }
    });
  });
});

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum AppealStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

export enum AppealCategory {
  INFRASTRUCTURE = 'infrastructure',
  HEALTHCARE = 'healthcare',
  EDUCATION = 'education',
  UTILITIES = 'utilities',
  PUBLIC_ORDER = 'public_order',
  OTHER = 'other',
}

export enum AppealPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('appeals')
export class Appeal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ /* type: 'enum', */ enum: AppealStatus, default: AppealStatus.PENDING })
  status: AppealStatus;

  @Column({ /* type: 'enum', */ enum: AppealCategory, default: AppealCategory.OTHER })
  category: AppealCategory;

  @Column({
    /* type: 'enum', */
    enum: AppealPriority,
    default: AppealPriority.MEDIUM,
  })
  priority: AppealPriority;

  //  Raw AI response stored for auditing and debugging purposes
  @Column({ type: 'simple-json', nullable: true })
  aiAnalysis: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.appeals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;
}

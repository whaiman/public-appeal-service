import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Appeal } from '../../appeals/entities/appeal.entity';

export enum UserRole {
  CITIZEN = 'citizen',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  fullName: string;

  // Never expose this field in responses: use @Exclude() in serialization
  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CITIZEN })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Appeal, (appeal) => appeal.user)
  appeals: Appeal[];
}

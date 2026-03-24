import { IsEnum } from 'class-validator';
import { AppealStatus } from '../entities/appeal.entity';

export class UpdateAppealStatusDto {
  @IsEnum(AppealStatus)
  status: AppealStatus;
}

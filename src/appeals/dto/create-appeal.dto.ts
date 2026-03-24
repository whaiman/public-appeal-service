import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateAppealDto {
  @IsString()
  @MinLength(10)
  @MaxLength(150)
  title: string;

  @IsString()
  @MinLength(30)
  @MaxLength(2000)
  description: string;
}

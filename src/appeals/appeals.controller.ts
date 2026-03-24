import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AppealsService } from './appeals.service';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { UpdateAppealStatusDto } from './dto/update-appeal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@Controller('appeals')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppealsController {
  constructor(private readonly appealsService: AppealsService) {}

  @Post()
  create(@Body() dto: CreateAppealDto, @CurrentUser() user: User) {
    return this.appealsService.create(dto, user);
  }

  @Get('my')
  findMyAppeals(@CurrentUser() user: User) {
    return this.appealsService.findMyAppeals(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.appealsService.findOne(id, user);
  }

  // Admin-only endpoints
  @Get()
  @Roles(UserRole.ADMIN)
  findAll() {
    return this.appealsService.findAll();
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppealStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.appealsService.updateStatus(id, dto, user);
  }
}

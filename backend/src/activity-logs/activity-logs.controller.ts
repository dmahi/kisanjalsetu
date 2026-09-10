import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';
import { ROLES } from '../common/constants';
import { ActivityLogsService } from './activity-logs.service';

@ApiTags('activity-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN)
@Controller('api/admin/activity-logs')
export class ActivityLogsController {
  constructor(private readonly logsService: ActivityLogsService) {}

  @Get()
  async list(@Query('entityType') entityType?: string, @Query('entityId') entityId?: string, @Query('limit') limit?: string) {
    const logs = await this.logsService.list({
      entityType,
      entityId,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    return logs.map((l) => ({
      id: String(l._id),
      userId: String(l.userId),
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      oldValues: l.oldValues,
      newValues: l.newValues,
      description: l.description,
      ipAddress: l.ipAddress,
      createdAt: (l as any).createdAt,
    }));
  }
}
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ROLES } from '../common/constants';
import { WaterQueueService } from './water-queue.service';
import { TubewellsService } from '../tubewells/tubewells.service';

@ApiTags('water-queue')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR, ROLES.FARMER)
@Controller()
export class WaterQueueController {
  constructor(
    private readonly waterQueueService: WaterQueueService,
    private readonly tubewellsService: TubewellsService,
  ) {}

  @Get('api/tubewell/water-queue')
  async getQueue(
    @CurrentUser() user: AuthUser,
    @Query('tubewellId') tubewellId: string,
  ) {
    if (!tubewellId) throw new BadRequestException('tubewellId query parameter is required');
    if (user.role === ROLES.TUBEWELL_OWNER || user.role === ROLES.OPERATOR) {
      await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    } else {
      await this.tubewellsService.verifyApprovedMembership(tubewellId, user.id);
    }
    return this.waterQueueService.getQueueForTubewell(tubewellId);
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Post(['api/water-queue/:id/move-up', 'api/tubewell/water-queue/:id/move-up'])
  async moveUp(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.waterQueueService.moveUp(user.id, id);
    return { success: true };
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Post(['api/water-queue/:id/move-down', 'api/tubewell/water-queue/:id/move-down'])
  async moveDown(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.waterQueueService.moveDown(user.id, id);
    return { success: true };
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Post(['api/water-queue/:id/move-to-start', 'api/tubewell/water-queue/:id/move-to-start'])
  async moveToStart(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.waterQueueService.moveToStart(user.id, id);
    return { success: true };
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Post(['api/water-queue/:id/move-to-end', 'api/tubewell/water-queue/:id/move-to-end'])
  async moveToEnd(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.waterQueueService.moveToEnd(user.id, id);
    return { success: true };
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Post(['api/water-queue/:id/remove', 'api/tubewell/water-queue/:id/remove'])
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.waterQueueService.remove(user.id, id);
    return { success: true };
  }
}

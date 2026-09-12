import {
  BadRequestException,
  Body,
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
import { WaterTurnAlertsService } from './water-turn-alerts.service';
import {
  CancelWaterTurnAlertDto,
  CreateWaterTurnAlertDto,
  RespondWaterTurnAlertDto,
} from './dto/water-turn-alert.dto';

@ApiTags('water-turn-alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class WaterTurnAlertsController {
  constructor(private readonly alertsService: WaterTurnAlertsService) {}

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Post('api/water-turn-alerts')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateWaterTurnAlertDto) {
    return this.alertsService.createAlert(user.id, dto);
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR, ROLES.FARMER)
  @Get('api/water-turn-alerts/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.alertsService.getAlert(user.id, id, user.role);
  }

  @Roles(ROLES.FARMER)
  @Post('api/water-turn-alerts/:id/response')
  async respond(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondWaterTurnAlertDto,
  ) {
    return this.alertsService.respond(user.id, id, dto);
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Post('api/water-turn-alerts/:id/retry')
  async retry(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.alertsService.manualRetry(user.id, id);
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Post('api/water-turn-alerts/:id/cancel')
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelWaterTurnAlertDto,
  ) {
    return this.alertsService.cancelAlert(user.id, id, dto?.reason);
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Get('api/tubewell/water-turn-alerts')
  async listForOwner(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId: string) {
    if (!tubewellId) throw new BadRequestException('tubewellId query parameter is required');
    return this.alertsService.listForOwner(user.id, tubewellId);
  }

  @Roles(ROLES.FARMER)
  @Get('api/customer/water-turn-alerts')
  async listForFarmer(
    @CurrentUser() user: AuthUser,
    @Query('tubewellId') tubewellId?: string,
  ) {
    return this.alertsService.listForFarmer(user.id, tubewellId);
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR, ROLES.FARMER)
  @Get('api/tubewell/water-queue/:tubewellId/next')
  async next(@CurrentUser() user: AuthUser, @Param('tubewellId') tubewellId: string) {
    return this.alertsService.getNextForTubewell(user.id, tubewellId, user.role);
  }
}
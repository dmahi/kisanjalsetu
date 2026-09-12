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
import { WaterRequestsService } from './water-requests.service';
import { CreateWaterRequestDto, RejectWaterRequestDto, WaterRequestFiltersQueryDto } from './dto/water-request.dto';

@ApiTags('customer-water-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.FARMER)
@Controller('api/customer/water-requests')
export class CustomerWaterRequestsController {
  constructor(private readonly waterRequestsService: WaterRequestsService) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateWaterRequestDto) {
    return this.waterRequestsService.createRequest(user.id, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('tubewellId') tubewellId?: string,
    @Query('status') status?: string,
  ) {
    return this.waterRequestsService.listForCustomer(user.id, tubewellId, status);
  }

  @Post(':id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.waterRequestsService.cancelRequest(user.id, id);
  }
}

@ApiTags('owner-water-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
@Controller('api/tubewell/water-requests')
export class OwnerWaterRequestsController {
  constructor(private readonly waterRequestsService: WaterRequestsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('tubewellId') tubewellId: string,
    @Query('status') status?: string,
  ) {
    if (!tubewellId) throw new BadRequestException('tubewellId query parameter is required');
    return this.waterRequestsService.listForOwner(user.id, tubewellId, status);
  }

  @Post(':id/accept')
  async accept(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.waterRequestsService.acceptRequest(user.id, id);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RejectWaterRequestDto,
  ) {
    return this.waterRequestsService.rejectRequest(user.id, id, dto);
  }
}

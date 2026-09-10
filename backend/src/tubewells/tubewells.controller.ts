import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ROLES, TUBEWELL_STATUS } from '../common/constants';
import { TubewellsService } from './tubewells.service';
import { UsersService } from '../users/users.service';
import { FieldsService } from '../fields/fields.service';
import {
  BecomeOwnerDto,
  CreateTubewellDto,
  UpdateTubewellDto,
  UpdateTubewellSettingsDto,
} from './dto/tubewell.dto';
import { MoneyService } from '../common/money.service';

@ApiTags('tubewells')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/tubewells')
export class TubewellsController {
  constructor(
    private readonly tubewellsService: TubewellsService,
    private readonly money: MoneyService,
    private readonly jwt: JwtService,
  ) {}

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTubewellDto) {
    const doc = await this.tubewellsService.create(user.id, dto);
    return this.serialize(doc);
  }

  @Roles(ROLES.FARMER)
  @Post('become-owner')
  async becomeOwner(@CurrentUser() user: AuthUser, @Body() dto: BecomeOwnerDto) {
    const { user: updatedUser, tubewell } = await this.tubewellsService.becomeOwner(user.id, dto);
    const token = await this.jwt.signAsync({
      sub: String(updatedUser._id),
      phone: updatedUser.phone,
      role: updatedUser.role,
    });
    return {
      token,
      user: {
        id: String(updatedUser._id),
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        status: updatedUser.status,
        profileImage: updatedUser.profileImage || null,
        createdAt: updatedUser.createdAt,
      },
      tubewell: this.serialize(tubewell),
      message: 'Welcome to the Tubewell Owner community!',
    };
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Get('mine')
  async mine(@CurrentUser() user: AuthUser) {
    const docs = await this.tubewellsService.listForOwner(user.id);
    return docs.map((d) => this.serialize(d));
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTubewellDto,
  ) {
    const doc = await this.tubewellsService.update(id, user.id, dto);
    return this.serialize(doc);
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Put(':id/settings')
  async updateSettings(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTubewellSettingsDto,
  ) {
    await this.tubewellsService.ownerMustOwn(id, user.id);
    const doc = await this.tubewellsService.update(id, user.id, { settings: dto });
    return this.serialize(doc);
  }

  @Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.tubewellsService.remove(id, user.id);
    return { deleted: true };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const doc = await this.tubewellsService.findByIdOrThrow(id);
    return this.serializePublic(doc);
  }

  serialize(doc: any) {
    return {
      id: String(doc._id),
      name: doc.name,
      code: doc.code,
      type: doc.type || null,
      images: doc.images ?? [],
      description: doc.description || null,
      address: doc.address,
      village: doc.village || null,
      city: doc.city || null,
      state: doc.state || null,
      country: doc.country || null,
      pincode: doc.pincode || null,
      latitude: doc.latitude ?? null,
      longitude: doc.longitude ?? null,
      status: doc.status,
      ownerId: String(doc.ownerId),
      settings: {
        ratePerHourPaise: doc.settings?.ratePerHourPaise ?? 0,
        ratePerHour: this.money.paiseToRupees(doc.settings?.ratePerHourPaise ?? 0),
        operatingStartTime: doc.settings?.operatingStartTime ?? null,
        operatingEndTime: doc.settings?.operatingEndTime ?? null,
        allowCustomerRequest: doc.settings?.allowCustomerRequest ?? true,
        maxSessionMinutes: doc.settings?.maxSessionMinutes ?? 0,
      },
      createdAt: doc.createdAt,
    };
  }

  serializePublic(doc: any) {
    return {
      id: String(doc._id),
      name: doc.name,
      code: doc.code,
      type: doc.type || null,
      images: doc.images ?? [],
      description: doc.description || null,
      address: doc.address,
      village: doc.village || null,
      city: doc.city || null,
      state: doc.state || null,
      country: doc.country || null,
      pincode: doc.pincode || null,
      latitude: doc.latitude ?? null,
      longitude: doc.longitude ?? null,
      status: doc.status,
      ratePerHour: this.money.paiseToRupees(doc.settings?.ratePerHourPaise ?? 0),
      allowCustomerRequest: doc.settings?.allowCustomerRequest ?? true,
    };
  }
}

@ApiTags('tubewells')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/tubewells')
export class TubewellSearchController {
  constructor(
    private readonly tubewellsService: TubewellsService,
    private readonly money: MoneyService,
  ) {}

  @Get()
  async search(
    @Query('search') search?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('maxDistanceKm') maxDistanceKm?: string,
  ) {
    const docs = await this.tubewellsService.search({
      search,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      maxDistanceKm: maxDistanceKm ? parseFloat(maxDistanceKm) : undefined,
    });
    return docs.map((d) => ({
      id: String(d._id),
      name: d.name,
      code: d.code,
      description: d.description || null,
      address: d.address,
      village: d.village || null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      status: d.status,
      ratePerHour: this.money.paiseToRupees(d.settings?.ratePerHourPaise ?? 0),
    }));
  }

  @Get('public/:id')
  async publicDetail(@Param('id') id: string) {
    const d = await this.tubewellsService.findByIdOrThrow(id);
    return {
      id: String(d._id),
      name: d.name,
      code: d.code,
      description: d.description || null,
      address: d.address,
      village: d.village || null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      status: d.status,
      ratePerHour: this.money.paiseToRupees(d.settings?.ratePerHourPaise ?? 0),
      allowCustomerRequest: d.settings?.allowCustomerRequest ?? true,
    };
  }
}

@ApiTags('tubewell-customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.TUBEWELL_OWNER, ROLES.OPERATOR)
@Controller('api/tubewell/customers')
export class TubewellCustomersController {
  constructor(
    private readonly tubewellsService: TubewellsService,
    private readonly usersService: UsersService,
    private readonly fieldsService: FieldsService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('tubewellId') tubewellId: string, @Query('search') search?: string) {
    if (!tubewellId) throw new BadRequestException('tubewellId query parameter is required');
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    const rows = await this.tubewellsService.listCustomersForOwner(tubewellId, search);
    return rows.map(({ membership, user: u }) => ({
      membershipId: String(membership._id),
      customerId: u.id,
      name: u.name,
      phone: u.phone,
      status: membership.status,
      requestedAt: membership.requestedAt,
      approvedAt: membership.approvedAt,
    }));
  }

  @Get(':customerId/fields')
  async customerFields(
    @CurrentUser() user: AuthUser,
    @Param('customerId') customerId: string,
    @Query('tubewellId') tubewellId: string,
  ) {
    if (!tubewellId) throw new BadRequestException('tubewellId query parameter is required');
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    await this.tubewellsService.verifyApprovedMembership(tubewellId, customerId);
    const fields = await this.fieldsService.listForCustomer(customerId);
    return fields.map((f) => ({
      id: String(f._id),
      name: f.name,
      area: f.area,
      areaUnit: f.areaUnit,
      location: f.location,
      notes: f.notes,
    }));
  }

  @Post(':customerId/approve')
  async approve(
    @CurrentUser() user: AuthUser,
    @Param('customerId') customerId: string,
    @Body('tubewellId') tubewellId: string,
  ) {
    if (!tubewellId) throw new BadRequestException('tubewellId body parameter is required');
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    return this.tubewellsService.membershipAction(tubewellId, customerId, 'approve', user.id);
  }

  @Post(':customerId/reject')
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('customerId') customerId: string,
    @Body('tubewellId') tubewellId: string,
  ) {
    if (!tubewellId) throw new BadRequestException('tubewellId body parameter is required');
    await this.tubewellsService.ownerMustOwn(tubewellId, user.id);
    return this.tubewellsService.membershipAction(tubewellId, customerId, 'reject', user.id);
  }
}

@ApiTags('customer-tubewells')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.FARMER)
@Controller('api/customer/tubewells')
export class CustomerTubewellsController {
  constructor(
    private readonly tubewellsService: TubewellsService,
    private readonly money: MoneyService,
  ) {}

  @Get()
  async myTubewells(@CurrentUser() user: AuthUser) {
    const memberships = await this.tubewellsService.listMembershipsForCustomer(user.id);
    const out: Array<Record<string, unknown>> = [];
    for (const m of memberships) {
      const t = await this.tubewellsService.findById(String(m.tubewellId));
      if (!t) continue;
      out.push({
        membershipId: String(m._id),
        tubewellId: String(t._id),
        name: t.name,
        code: t.code,
        address: t.address,
        village: t.village || null,
        status: t.status,
        membershipStatus: m.status,
        ratePerHour: this.money.paiseToRupees(t.settings?.ratePerHourPaise ?? 0),
      });
    }
    return out;
  }

  @Post(':id/request')
  async request(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tubewellsService.requestMembership(id, user.id);
  }
}

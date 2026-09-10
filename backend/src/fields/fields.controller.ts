import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ROLES } from '../common/constants';
import { FieldsService } from './fields.service';
import { CreateFieldDto, UpdateFieldDto } from './dto/field.dto';

@ApiTags('fields')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.FARMER)
@Controller('api/fields')
export class FieldsController {
  constructor(private readonly fieldsService: FieldsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const items = await this.fieldsService.listForCustomer(user.id);
    return items.map((f) => ({
      id: String(f._id),
      name: f.name,
      area: f.area,
      areaUnit: f.areaUnit,
      location: f.location || null,
      notes: f.notes || null,
    }));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFieldDto) {
    return this.fieldsService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateFieldDto) {
    return this.fieldsService.update(user.id, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.fieldsService.remove(user.id, id);
    return { deleted: true };
  }
}
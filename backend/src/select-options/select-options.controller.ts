import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SelectOptionsService } from './select-options.service';
import { CreateSelectOptionDto } from './dto/create-select-option.dto';
import { UpdateSelectOptionDto } from './dto/update-select-option.dto';
import { Roles } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('select-options')
@Controller('api')
export class SelectOptionsController {
  constructor(private readonly optionsService: SelectOptionsService) {}

  @Get('select-options')
  @ApiQuery({ name: 'categories', required: false, description: 'Comma-separated category keys' })
  async listByCategories(@Query('categories') categories?: string) {
    const wanted = categories
      ? categories.split(',').map((c) => c.trim()).filter(Boolean)
      : undefined;
    const group = await this.optionsService.listByCategories(wanted);
    const out: Record<string, unknown[]> = {};
    for (const [category, docs] of Object.entries(group)) {
      out[category] = docs.map((d) => ({
        code: d.code,
        label: d.labels,
        sortOrder: d.sortOrder,
      }));
    }
    return out;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/select-options')
  async adminList(@Query('category') category?: string) {
    const docs = await this.optionsService.adminList(category || undefined);
    return docs.map((d) => ({
      id: String(d._id),
      category: d.category,
      code: d.code,
      labels: d.labels,
      sortOrder: d.sortOrder,
      active: d.active,
      updatedAt: (d as any).updatedAt,
    }));
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/select-options')
  async adminCreate(@Body() dto: CreateSelectOptionDto) {
    const doc = await this.optionsService.adminCreate(dto);
    return {
      id: String(doc._id),
      category: doc.category,
      code: doc.code,
      labels: doc.labels,
      sortOrder: doc.sortOrder,
      active: doc.active,
      updatedAt: (doc as any).updatedAt,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/select-options/:id')
  async adminUpdate(@Body() dto: UpdateSelectOptionDto, @Param('id') id: string) {
    const doc = await this.optionsService.adminUpdate(id, dto);
    return {
      id: String(doc._id),
      category: doc.category,
      code: doc.code,
      labels: doc.labels,
      sortOrder: doc.sortOrder,
      active: doc.active,
      updatedAt: (doc as any).updatedAt,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('admin/select-options/:id')
  async adminRemove(@Param('id') id: string) {
    await this.optionsService.adminRemove(id);
    return { message: 'Option deleted' };
  }
}
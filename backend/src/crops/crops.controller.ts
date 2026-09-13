import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CropsService } from './crops.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators';

@ApiTags('crops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api')
export class CropsController {
  constructor(private readonly cropsService: CropsService) {}

  @Get('crops')
  async list() {
    const items = await this.cropsService.list();
    return items.map((c) => ({
      id: String(c._id),
      name: c.name,
      labels: c.labels || { en: c.name },
      status: c.status,
    }));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/crops')
  async adminList() {
    const items = await this.cropsService.adminList();
    return items.map((c) => ({
      id: String(c._id),
      name: c.name,
      labels: c.labels || { en: c.name },
      status: c.status,
      updatedAt: (c as any).updatedAt,
    }));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post('admin/crops')
  async adminCreate(@Body() body: { name: string; labels?: Record<string, string> }) {
    if (!body || !body.name || !body.name.trim()) {
      return { error: 'name is required' };
    }
    const doc = await this.cropsService.adminCreate({ name: body.name, labels: body.labels as any });
    return { id: String(doc._id), name: doc.name, labels: doc.labels, status: doc.status };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/crops/:id')
  async adminUpdate(
    @Param('id') id: string,
    @Body() body: { name?: string; labels?: Record<string, string>; status?: 'active' | 'inactive' },
  ) {
    const doc = await this.cropsService.adminUpdate(id, body);
    return { id: String(doc._id), name: doc.name, labels: doc.labels, status: doc.status };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('admin/crops/:id')
  async adminRemove(@Param('id') id: string) {
    await this.cropsService.adminRemove(id);
    return { message: 'Crop removed' };
  }
}
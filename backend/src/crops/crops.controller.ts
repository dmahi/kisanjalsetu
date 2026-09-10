import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CropsService } from './crops.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('crops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/crops')
export class CropsController {
  constructor(private readonly cropsService: CropsService) {}

  @Get()
  async list() {
    const items = await this.cropsService.list();
    return items.map((c) => ({ id: String(c._id), name: c.name }));
  }
}
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { CurrentUser, AuthUser, Roles } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('settings')
@Controller('api')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('settings/public')
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/settings')
  async getAdminSettings() {
    const doc = await this.settingsService.getSettings();
    return {
      appName: doc.appName,
      firebaseServiceAccount: doc.firebaseServiceAccount || '',
      firebaseServerKey: doc.firebaseServerKey || '',
      updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
      updatedAt: (doc as any).updatedAt,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Patch('admin/settings')
  async updateAdminSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    const doc = await this.settingsService.updateSettings(dto, user.id);
    return {
      appName: doc.appName,
      firebaseServiceAccount: doc.firebaseServiceAccount || '',
      firebaseServerKey: doc.firebaseServerKey || '',
      updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
      updatedAt: (doc as any).updatedAt,
    };
  }
}

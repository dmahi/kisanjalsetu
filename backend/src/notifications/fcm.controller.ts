import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators';
import { FcmService } from './fcm.service';

class RegisterFcmTokenDto {
  @IsString()
  @MaxLength(4096)
  token: string;

  @IsOptional()
  @IsIn(['fcm', 'apns'])
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @IsOptional()
  @IsIn(['phone', 'tablet', 'web'])
  deviceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

class LogoutFcmTokenDto {
  @IsString()
  @MaxLength(4096)
  token: string;
}

/**
 * FCM device token lifecycle. One user can hold many active registered devices
 * (multi-device push), and a single logout only deactivates the token the
 * calling client is holding.
 */
@ApiTags('fcm-devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/device')
export class FcmController {
  constructor(private readonly fcmService: FcmService) {}

  @Post('fcm-token')
  async register(@CurrentUser() user: AuthUser, @Body() dto: RegisterFcmTokenDto) {
    await this.fcmService.registerToken(user.id, dto);
    return { registered: true };
  }

  @Post('fcm-token/logout')
  async logout(@CurrentUser() user: AuthUser, @Body() dto: LogoutFcmTokenDto) {
    const loggedOut = await this.fcmService.deactivateUserDeviceToken(user.id, dto.token);
    return { loggedOut };
  }

  /** Hard-delete (app uninstall / full cleanup). */
  @Post('fcm-token/remove')
  async remove(@CurrentUser() user: AuthUser, @Body() dto: LogoutFcmTokenDto) {
    const removed = await this.fcmService.unregisterToken(user.id, dto.token);
    return { removed };
  }
}
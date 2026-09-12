import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser, AuthUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const doc = await this.usersService.findByIdOrThrow(user.id);
    return {
      id: String(doc._id),
      name: doc.name,
      appName: doc.appName || null,
      phone: doc.phone,
      email: doc.email || null,
      role: doc.role,
      status: doc.status,
      profileImage: doc.profileImage || null,
      phoneVerifiedAt: doc.phoneVerifiedAt,
    };
  }

  @Patch('me')
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    const doc = await this.usersService.updateProfile(user.id, dto);
    return {
      id: String(doc._id),
      name: doc.name,
      appName: doc.appName || null,
      phone: doc.phone,
      email: doc.email || null,
      role: doc.role,
      status: doc.status,
      profileImage: doc.profileImage || null,
    };
  }
}
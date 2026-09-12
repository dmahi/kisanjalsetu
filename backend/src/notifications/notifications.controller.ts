import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    const items = await this.notificationsService.listForUser(user.id, limit ? parseInt(limit, 10) : 50);
    return items.map((n) => ({
      id: String(n._id),
      title: n.title,
      body: n.body ?? null,
      type: n.type ?? null,
      data: n.data ?? null,
      readAt: n.readAt ?? null,
      createdAt: (n as any).createdAt,
    }));
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: AuthUser) {
    return { count: await this.notificationsService.unreadCount(user.id) };
  }

  @Post(':id/read')
  async read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.notificationsService.markRead(user.id, id);
    return { read: true };
  }

  @Post('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    await this.notificationsService.markAllRead(user.id);
    return { read: true };
  }
}
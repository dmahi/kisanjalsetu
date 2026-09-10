import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DeviceToken,
  DeviceTokenSchema,
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';
import { PushSender } from './push.sender';
import {
  DeviceTokenController,
  NotificationsController,
} from './notifications.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: DeviceToken.name, schema: DeviceTokenSchema },
    ]),
  ],
  providers: [NotificationsService, PushSender],
  exports: [NotificationsService],
  controllers: [NotificationsController, DeviceTokenController],
})
export class NotificationsModule {}
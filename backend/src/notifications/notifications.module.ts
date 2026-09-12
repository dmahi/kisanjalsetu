import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DeviceToken,
  DeviceTokenSchema,
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { NotificationsService } from './notifications.service';
import { FcmService } from './fcm.service';
import { PushSender } from './push.sender';
import { NotificationsController } from './notifications.controller';
import { FcmController } from './fcm.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: DeviceToken.name, schema: DeviceTokenSchema },
    ]),
  ],
  providers: [NotificationsService, FcmService, PushSender],
  exports: [NotificationsService, FcmService],
  controllers: [NotificationsController, FcmController],
})
export class NotificationsModule {}
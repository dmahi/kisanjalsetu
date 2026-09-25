import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WaterQueueEntry, WaterQueueEntrySchema } from './schemas/water-queue.schema';
import { WaterQueueService } from './water-queue.service';
import { WaterQueueController } from './water-queue.controller';
import { TubewellsModule } from '../tubewells/tubewells.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FieldsModule } from '../fields/fields.module';
import { UsersModule } from '../users/users.module';
import { WaterRequest, WaterRequestSchema } from '../water-requests/schemas/water-request.schema';
import { WaterSession, WaterSessionSchema } from '../sessions/schemas/water-session.schema';
import { TranslationService } from '../i18n/translation.service';
import { WaterModule } from '../water/water.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaterQueueEntry.name, schema: WaterQueueEntrySchema },
      { name: WaterRequest.name, schema: WaterRequestSchema },
      { name: WaterSession.name, schema: WaterSessionSchema },
    ]),
    TubewellsModule,
    NotificationsModule,
    FieldsModule,
    UsersModule,
    WaterModule,
  ],
  controllers: [WaterQueueController],
  providers: [WaterQueueService, TranslationService],
  exports: [WaterQueueService, MongooseModule],
})
export class WaterQueueModule {}

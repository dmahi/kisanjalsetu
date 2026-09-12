import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WaterQueueEntry, WaterQueueEntrySchema } from './schemas/water-queue.schema';
import { WaterQueueService } from './water-queue.service';
import { WaterQueueController } from './water-queue.controller';
import { TubewellsModule } from '../tubewells/tubewells.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FieldsModule } from '../fields/fields.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WaterQueueEntry.name, schema: WaterQueueEntrySchema }]),
    TubewellsModule,
    NotificationsModule,
    FieldsModule,
    UsersModule,
  ],
  controllers: [WaterQueueController],
  providers: [WaterQueueService],
  exports: [WaterQueueService, MongooseModule],
})
export class WaterQueueModule {}

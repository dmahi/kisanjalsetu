import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WaterRequest, WaterRequestSchema } from './schemas/water-request.schema';
import { WaterRequestsService } from './water-requests.service';
import {
  CustomerWaterRequestsController,
  OwnerWaterRequestsController,
} from './water-requests.controller';
import { TubewellsModule } from '../tubewells/tubewells.module';
import { FieldsModule } from '../fields/fields.module';
import { CropsModule } from '../crops/crops.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WaterQueueModule } from '../water-queue/water-queue.module';
import { WaterSession, WaterSessionSchema } from '../sessions/schemas/water-session.schema';
import { WaterQueueEntry, WaterQueueEntrySchema } from '../water-queue/schemas/water-queue.schema';
import { MoneyService } from '../common/money.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaterRequest.name, schema: WaterRequestSchema },
      { name: WaterQueueEntry.name, schema: WaterQueueEntrySchema },
      { name: WaterSession.name, schema: WaterSessionSchema },
    ]),
    TubewellsModule,
    FieldsModule,
    CropsModule,
    UsersModule,
    NotificationsModule,
    WaterQueueModule,
  ],
  controllers: [CustomerWaterRequestsController, OwnerWaterRequestsController],
  providers: [WaterRequestsService, MoneyService],
  exports: [WaterRequestsService, MongooseModule],
})
export class WaterRequestsModule {}

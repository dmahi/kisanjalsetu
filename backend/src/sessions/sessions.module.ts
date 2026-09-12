import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WaterSession, WaterSessionSchema } from './schemas/water-session.schema';
import { WaterQueueEntry, WaterQueueEntrySchema } from '../water-queue/schemas/water-queue.schema';
import { WaterRequest, WaterRequestSchema } from '../water-requests/schemas/water-request.schema';
import { SessionsService } from './sessions.service';
import { BillingService } from './billing.service';
import { CustomerSessionsController, OwnerSessionsController } from './sessions.controller';
import { TubewellsModule } from '../tubewells/tubewells.module';
import { FieldsModule } from '../fields/fields.module';
import { CropsModule } from '../crops/crops.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WaterQueueModule } from '../water-queue/water-queue.module';
import { MoneyService } from '../common/money.service';
import { WaterModule } from '../water/water.module';
import { WaterGateway } from '../water/water.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaterSession.name, schema: WaterSessionSchema },
      { name: WaterQueueEntry.name, schema: WaterQueueEntrySchema },
      { name: WaterRequest.name, schema: WaterRequestSchema },
    ]),
    TubewellsModule,
    FieldsModule,
    CropsModule,
    ActivityLogsModule,
    UsersModule,
    NotificationsModule,
    WaterQueueModule,
    WaterModule,
  ],
  providers: [SessionsService, BillingService, MoneyService, WaterGateway],
  exports: [SessionsService, BillingService, WaterGateway],
  controllers: [OwnerSessionsController, CustomerSessionsController],
})
export class SessionsModule {}
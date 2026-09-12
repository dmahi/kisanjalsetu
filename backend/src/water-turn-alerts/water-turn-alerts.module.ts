import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WaterTurnAlert,
  WaterTurnAlertSchema,
} from './schemas/water-turn-alert.schema';
import {
  WaterQueueEntry,
  WaterQueueEntrySchema,
} from '../water-queue/schemas/water-queue.schema';
import {
  WaterSession,
  WaterSessionSchema,
} from '../sessions/schemas/water-session.schema';
import { WaterTurnAlertsService } from './water-turn-alerts.service';
import { WaterTurnAlertsController } from './water-turn-alerts.controller';
import { WaterTurnScheduler } from './water-turn-alerts.scheduler';
import { TubewellsModule } from '../tubewells/tubewells.module';
import { UsersModule } from '../users/users.module';
import { FieldsModule } from '../fields/fields.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaterTurnAlert.name, schema: WaterTurnAlertSchema },
      { name: WaterQueueEntry.name, schema: WaterQueueEntrySchema },
      { name: WaterSession.name, schema: WaterSessionSchema },
    ]),
    TubewellsModule,
    UsersModule,
    FieldsModule,
    NotificationsModule,
    ActivityLogsModule,
  ],
  controllers: [WaterTurnAlertsController],
  providers: [WaterTurnAlertsService, WaterTurnScheduler],
  exports: [WaterTurnAlertsService],
})
export class WaterTurnAlertsModule {}
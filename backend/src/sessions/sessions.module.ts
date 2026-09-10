import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WaterSession, WaterSessionSchema } from './schemas/water-session.schema';
import { SessionsService } from './sessions.service';
import { BillingService } from './billing.service';
import { CustomerSessionsController, OwnerSessionsController } from './sessions.controller';
import { TubewellsModule } from '../tubewells/tubewells.module';
import { FieldsModule } from '../fields/fields.module';
import { CropsModule } from '../crops/crops.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MoneyService } from '../common/money.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WaterSession.name, schema: WaterSessionSchema }]),
    TubewellsModule,
    FieldsModule,
    CropsModule,
    ActivityLogsModule,
    UsersModule,
    NotificationsModule,
  ],
  providers: [SessionsService, BillingService, MoneyService],
  exports: [SessionsService, BillingService],
  controllers: [OwnerSessionsController, CustomerSessionsController],
})
export class SessionsModule {}
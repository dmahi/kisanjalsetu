import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Payment,
  PaymentRequest,
  PaymentRequestSchema,
  PaymentSchema,
} from './schemas/payment.schema';
import { PaymentsService } from './payments.service';
import { LedgerService } from './ledger.service';
import {
  CustomerPaymentsController,
  OwnerPaymentsController,
} from './payments.controller';
import { SessionsModule } from '../sessions/sessions.module';
import { TubewellsModule } from '../tubewells/tubewells.module';
import { UsersModule } from '../users/users.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MoneyService } from '../common/money.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentRequest.name, schema: PaymentRequestSchema },
    ]),
    SessionsModule,
    TubewellsModule,
    UsersModule,
    ActivityLogsModule,
    NotificationsModule,
  ],
  providers: [PaymentsService, LedgerService, MoneyService],
  exports: [PaymentsService, LedgerService],
  controllers: [CustomerPaymentsController, OwnerPaymentsController],
})
export class PaymentsModule {}
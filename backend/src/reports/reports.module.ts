import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WaterSession, WaterSessionSchema } from '../sessions/schemas/water-session.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TubewellsModule } from '../tubewells/tubewells.module';
import { SessionsModule } from '../sessions/sessions.module';
import { MoneyService } from '../common/money.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WaterSession.name, schema: WaterSessionSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    TubewellsModule,
    SessionsModule,
    UsersModule,
  ],
  providers: [ReportsService, MoneyService],
  exports: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
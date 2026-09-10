import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Tubewell, TubewellSchema } from '../tubewells/schemas/tubewell.schema';
import { WaterSession, WaterSessionSchema } from '../sessions/schemas/water-session.schema';
import {
  Payment,
  PaymentRequest,
  PaymentRequestSchema,
  PaymentSchema,
} from '../payments/schemas/payment.schema';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { TubewellsModule } from '../tubewells/tubewells.module';
import { MoneyService } from '../common/money.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Tubewell.name, schema: TubewellSchema },
      { name: WaterSession.name, schema: WaterSessionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentRequest.name, schema: PaymentRequestSchema },
    ]),
    UsersModule,
    TubewellsModule,
  ],
  providers: [MoneyService],
  controllers: [AdminController],
})
export class AdminModule {}
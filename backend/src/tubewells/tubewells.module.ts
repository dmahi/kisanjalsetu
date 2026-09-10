import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tubewell, TubewellSchema } from './schemas/tubewell.schema';
import {
  TubewellCustomer,
  TubewellCustomerSchema,
} from './schemas/tubewell-customer.schema';
import { TubewellsService } from './tubewells.service';
import {
  CustomerTubewellsController,
  TubewellCustomersController,
  TubewellSearchController,
  TubewellsController,
} from './tubewells.controller';
import { UsersModule } from '../users/users.module';
import { FieldsModule } from '../fields/fields.module';
import { MoneyService } from '../common/money.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tubewell.name, schema: TubewellSchema },
      { name: TubewellCustomer.name, schema: TubewellCustomerSchema },
    ]),
    UsersModule,
    FieldsModule,
  ],
  providers: [TubewellsService, MoneyService],
  exports: [TubewellsService],
  controllers: [
    TubewellsController,
    TubewellSearchController,
    TubewellCustomersController,
    CustomerTubewellsController,
  ],
})
export class TubewellsModule {}
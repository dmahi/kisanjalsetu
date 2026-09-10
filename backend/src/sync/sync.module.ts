import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SessionsModule } from '../sessions/sessions.module';
import { PaymentsModule } from '../payments/payments.module';
import { TubewellsModule } from '../tubewells/tubewells.module';

@Module({
  imports: [SessionsModule, PaymentsModule, TubewellsModule],
  controllers: [SyncController],
})
export class SyncModule {}
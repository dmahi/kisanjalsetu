import { Module } from '@nestjs/common';
import { WaterGateway } from './water.gateway';

@Module({
  providers: [WaterGateway],
  exports: [WaterGateway],
})
export class WaterModule {}
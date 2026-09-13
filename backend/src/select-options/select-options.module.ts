import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SelectOption, SelectOptionSchema } from './schemas/select-option.schema';
import { SelectOptionsService } from './select-options.service';
import { SelectOptionsController } from './select-options.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SelectOption.name, schema: SelectOptionSchema }]),
  ],
  providers: [SelectOptionsService],
  exports: [SelectOptionsService],
  controllers: [SelectOptionsController],
})
export class SelectOptionsModule {}
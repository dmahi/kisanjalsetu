import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CropDocument = Crop & Document;

@Schema({ timestamps: true })
export class Crop {
  @Prop({ required: true, unique: true, index: true, trim: true })
  name: string;

  @Prop({ default: 'active', enum: ['active', 'inactive'] })
  status: string;
}

export const CropSchema = SchemaFactory.createForClass(Crop);
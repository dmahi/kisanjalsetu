import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FieldDocument = Field & Document;

@Schema({ timestamps: true })
export class Field {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Number, default: 0 })
  area: number;

  @Prop({ default: 'acre', enum: ['acre', 'hectare', 'bigha', 'gunta', 'other'] })
  areaUnit: string;

  @Prop({ trim: true })
  location?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ default: 'active', enum: ['active', 'inactive'] })
  status: string;
}

export const FieldSchema = SchemaFactory.createForClass(Field);
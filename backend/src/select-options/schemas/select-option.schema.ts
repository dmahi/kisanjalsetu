import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface SelectOptionLabels {
  en: string;
  hi?: string;
  pa?: string;
  [key: string]: string | undefined;
}

export type SelectOptionDocument = SelectOption & Document;

@Schema({ timestamps: true })
export class SelectOption {
  @Prop({ required: true, trim: true, index: true })
  category: string;

  @Prop({ required: true, trim: true })
  code: string;

  @Prop({ required: true, type: Object })
  labels: SelectOptionLabels;

  @Prop({ default: 0 })
  sortOrder: number;

  @Prop({ default: true })
  active: boolean;
}

export const SelectOptionSchema = SchemaFactory.createForClass(SelectOption);

SelectOptionSchema.index({ category: 1, code: 1 }, { unique: true });
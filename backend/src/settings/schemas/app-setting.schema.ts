import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AppSettingDocument = AppSetting & Document;

@Schema({ timestamps: true, collection: 'app_settings' })
export class AppSetting {
  @Prop({ default: 'KisanJalSetu', trim: true })
  appName: string;

  @Prop({ trim: true })
  firebaseServiceAccount?: string;

  @Prop({ trim: true })
  firebaseServerKey?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const AppSettingSchema = SchemaFactory.createForClass(AppSetting);

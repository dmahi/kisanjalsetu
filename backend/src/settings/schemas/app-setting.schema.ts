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

  @Prop({ default: false })
  showGoogleAds?: boolean;

  @Prop({ trim: true, default: 'ca-app-pub-3940256099942544/6300978111' })
  adMobBannerAdUnitId?: string;

  @Prop({ trim: true, default: 'ca-pub-3940256099942544' })
  adSensePublisherId?: string;

  @Prop({ trim: true, default: '6300978111' })
  adSenseSlotId?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const AppSettingSchema = SchemaFactory.createForClass(AppSetting);

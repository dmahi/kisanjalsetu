import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TUBEWELL_STATUS, TUBEWELL_TYPE } from '../../common/constants';

export type TubewellDocument = Tubewell & Document;

@Schema({ _id: false })
export class TubewellSettings {
  @Prop({ type: Number, required: true, default: 10000 })
  ratePerHourPaise: number;

  @Prop()
  operatingStartTime?: string;

  @Prop()
  operatingEndTime?: string;

  @Prop({ default: true })
  allowCustomerRequest: boolean;

  @Prop({ type: Number, default: 0 })
  maxSessionMinutes: number;
}

@Schema({ timestamps: true })
export class Tubewell {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true, trim: true, uppercase: true })
  code: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, trim: true })
  address: string;

  @Prop({ trim: true })
  village?: string;

  @Prop({ trim: true })
  city?: string;

  @Prop({ trim: true })
  state?: string;

  @Prop({ trim: true })
  country?: string;

  @Prop({ trim: true })
  pincode?: string;

  @Prop({ enum: Object.values(TUBEWELL_TYPE) })
  type?: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ type: Number })
  latitude?: number;

  @Prop({ type: Number })
  longitude?: number;

  @Prop({ type: Object })
  location?: { type: 'Point'; coordinates: [number, number] };

  @Prop({ enum: Object.values(TUBEWELL_STATUS), default: TUBEWELL_STATUS.ACTIVE })
  status: string;

  @Prop({ type: TubewellSettings, default: () => ({}) })
  settings: TubewellSettings;
}

export const TubewellSchema = SchemaFactory.createForClass(Tubewell);
TubewellSchema.index({ location: '2dsphere' });
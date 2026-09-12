import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WaterRequestDocument = WaterRequest & Document;

export enum WATER_REQUEST_STATUS {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true })
export class WaterRequest {
  @Prop({ type: Types.ObjectId, ref: 'Tubewell', required: true, index: true })
  tubewellId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Field', required: true })
  fieldId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Crop' })
  cropId?: Types.ObjectId;

  @Prop({ trim: true })
  cropName?: string;

  @Prop({ required: true, type: Number })
  requestedDurationMinutes: number;

  @Prop()
  requestedDate?: Date;

  @Prop({ trim: true })
  preferredStartTime?: string;

  @Prop({ trim: true })
  preferredEndTime?: string;

  @Prop({ trim: true })
  note?: string;

  @Prop({
    enum: Object.values(WATER_REQUEST_STATUS),
    default: WATER_REQUEST_STATUS.PENDING,
    index: true,
  })
  status: string;

  @Prop({ trim: true })
  rejectionReason?: string;

  @Prop()
  acceptedAt?: Date;

  @Prop()
  rejectedAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  completedAt?: Date;
}

export const WaterRequestSchema = SchemaFactory.createForClass(WaterRequest);
WaterRequestSchema.index({ tubewellId: 1, status: 1 });
WaterRequestSchema.index({ customerId: 1, status: 1 });

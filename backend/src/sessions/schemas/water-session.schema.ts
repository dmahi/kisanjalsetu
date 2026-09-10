import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  PAYMENT_STATUS,
  SESSION_STATUS,
} from '../../common/constants';

export type WaterSessionDocument = WaterSession & Document;

@Schema({ timestamps: true })
export class WaterSession {
  @Prop({ type: Types.ObjectId, ref: 'Tubewell', required: true, index: true })
  tubewellId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Field' })
  fieldId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Crop' })
  cropId?: Types.ObjectId;

  @Prop({ trim: true })
  cropName?: string;

  @Prop({ required: true })
  startDatetime: Date;

  @Prop()
  endDatetime?: Date;

  @Prop()
  durationMinutes?: number;

  @Prop()
  billableMinutes?: number;

  @Prop({ required: true, type: Number })
  ratePerHourPaise: number;

  @Prop({ type: Number })
  grossAmountPaise: number;

  @Prop({ type: Number, default: 0 })
  discountAmountPaise: number;

  @Prop({ enum: ['fixed', 'percentage'], nullable: true })
  discountType?: string;

  @Prop()
  discountValue?: number;

  @Prop({ trim: true })
  discountReason?: string;

  @Prop({ type: Number })
  finalAmountPaise: number;

  @Prop({ enum: Object.values(SESSION_STATUS), default: SESSION_STATUS.RUNNING })
  status: string;

  @Prop({ enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.UNPAID })
  paymentStatus: string;

  @Prop({ type: Number, default: 0 })
  paidAmountPaise: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  completedAt?: Date;

  @Prop({ unique: true, sparse: true, index: true })
  idempotencyKey?: string;

  /** Set only while status = 'running'. Unique partial index guarantees only
   *  one running session per tubewell at a time (concurrency-safe start). */
  @Prop({ type: Types.ObjectId })
  runningLock?: Types.ObjectId;

  @Prop()
  runningWarning?: string;
}

export const WaterSessionSchema = SchemaFactory.createForClass(WaterSession);
WaterSessionSchema.index({ tubewellId: 1, startDatetime: 1 });
WaterSessionSchema.index({ customerId: 1, startDatetime: -1 });
WaterSessionSchema.index({ status: 1 });
// One running session per tubewell
WaterSessionSchema.index(
  { runningLock: 1 },
  { unique: true, partialFilterExpression: { runningLock: { $type: 'objectId' } } },
);
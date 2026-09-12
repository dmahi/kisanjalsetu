import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WaterQueueEntryDocument = WaterQueueEntry & Document;

export enum QUEUE_STATUS {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REMOVED = 'removed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class WaterQueueEntry {
  @Prop({ type: Types.ObjectId, ref: 'Tubewell', required: true, index: true })
  tubewellId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WaterRequest', required: true, index: true })
  waterRequestId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Field', required: true })
  fieldId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Crop' })
  cropId?: Types.ObjectId;

  @Prop({ trim: true })
  cropName?: string;

  @Prop({ required: true, type: Number, index: true })
  queuePosition: number;

  @Prop({
    enum: Object.values(QUEUE_STATUS),
    default: QUEUE_STATUS.WAITING,
    index: true,
  })
  status: string;

  @Prop({ default: Date.now })
  queuedAt: Date;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  removedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'WaterSession' })
  waterSessionId?: Types.ObjectId;
}

export const WaterQueueEntrySchema = SchemaFactory.createForClass(WaterQueueEntry);
WaterQueueEntrySchema.index({ tubewellId: 1, status: 1, queuePosition: 1 });
WaterQueueEntrySchema.index({ customerId: 1, status: 1 });

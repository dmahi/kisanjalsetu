import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WaterTurnAlertDocument = WaterTurnAlert & Document;

export enum WATER_TURN_STATUS {
  PENDING = 'pending',
  SENT = 'sent',
  ACKNOWLEDGED = 'acknowledged',
  READY = 'ready',
  NOT_READY = 'not_ready',
  NO_RESPONSE = 'no_response',
  CANCELLED = 'cancelled',
}

export enum WATER_TURN_RESPONSE {
  READY = 'ready',
  NOT_READY = 'not_ready',
}

@Schema({ timestamps: true, collection: 'water_turn_alerts' })
export class WaterTurnAlert {
  @Prop({ type: Types.ObjectId, ref: 'Tubewell', required: true, index: true })
  tubewellId: Types.ObjectId;

  /** Must reference the queue *entry* — the same farmer can appear more than
   *  once (different fields / requests), so customerId alone is ambiguous. */
  @Prop({ type: Types.ObjectId, ref: 'WaterQueueEntry', required: true, index: true })
  waterQueueEntryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'WaterRequest', index: true })
  waterRequestId?: Types.ObjectId;

  /** Running session estimate context, when known at trigger time. */
  @Prop({ type: Types.ObjectId, ref: 'WaterSession' })
  waterSessionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  targetCustomerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Field' })
  fieldId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Crop' })
  cropId?: Types.ObjectId;

  @Prop({ trim: true })
  cropName?: string;

  /** Operator estimate of remaining time on the current session (advisory). */
  @Prop({ type: Number, default: 0 })
  estimatedRemainingMinutes: number;

  @Prop({ type: Number, default: 1 })
  attemptNumber: number;

  @Prop({ type: Number, default: 3 })
  maxAttempts: number;

  @Prop({
    enum: Object.values(WATER_TURN_STATUS),
    default: WATER_TURN_STATUS.PENDING,
    index: true,
  })
  status: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  responseDeadlineAt?: Date;

  @Prop()
  respondedAt?: Date;

  @Prop({ enum: Object.values(WATER_TURN_RESPONSE) })
  response?: string;

  @Prop({ trim: true })
  responseNote?: string;

  @Prop()
  noResponseAt?: Date;

  @Prop()
  delayNotifiedAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop({ trim: true })
  cancelledReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  sentBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  /** Set to the constant 'active' only while the alert cycle is live
   *  (PENDING/SENT/ACKNOWLEDGED). The partial unique index below guarantees
   *  at most one active alert per tubewell — this is the concurrency-safe
   *  guard against duplicate owner triggers (spec §17 Case 4). */
  @Prop({ type: String })
  activeFlag?: string;
}

export const WaterTurnAlertSchema = SchemaFactory.createForClass(WaterTurnAlert);
WaterTurnAlertSchema.index({ tubewellId: 1, status: 1 });
WaterTurnAlertSchema.index({ targetCustomerId: 1, status: 1 });
WaterTurnAlertSchema.index({ status: 1, responseDeadlineAt: 1 });
WaterTurnAlertSchema.index({ waterQueueEntryId: 1, createdAt: -1 });
// At most one live alert cycle per tubewell
WaterTurnAlertSchema.index(
  { tubewellId: 1, activeFlag: 1 },
  { unique: true, partialFilterExpression: { activeFlag: { $exists: true } } },
);
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivityLogDocument = ActivityLog & Document;

@Schema({ timestamps: true })
export class ActivityLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ index: true })
  entityType?: string;

  @Prop({ index: true })
  entityId?: string;

  @Prop({ type: Object })
  oldValues?: Record<string, unknown>;

  @Prop({ type: Object })
  newValues?: Record<string, unknown>;

  @Prop()
  description?: string;

  @Prop()
  ipAddress?: string;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
ActivityLogSchema.index({ entityType: 1, entityId: 1 });
ActivityLogSchema.index({ createdAt: -1 });
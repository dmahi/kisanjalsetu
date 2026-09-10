import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MEMBERSHIP_STATUS } from '../../common/constants';

export type TubewellCustomerDocument = TubewellCustomer & Document;

@Schema({ timestamps: true })
export class TubewellCustomer {
  @Prop({ type: Types.ObjectId, ref: 'Tubewell', required: true })
  tubewellId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  customerId: Types.ObjectId;

  @Prop({ enum: Object.values(MEMBERSHIP_STATUS), default: MEMBERSHIP_STATUS.PENDING })
  status: string;

  @Prop()
  requestedAt?: Date;

  @Prop()
  approvedAt?: Date;

  @Prop()
  rejectedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;
}

export const TubewellCustomerSchema = SchemaFactory.createForClass(TubewellCustomer);
TubewellCustomerSchema.index({ tubewellId: 1, customerId: 1 }, { unique: true });
TubewellCustomerSchema.index({ customerId: 1 });
TubewellCustomerSchema.index({ tubewellId: 1, status: 1 });
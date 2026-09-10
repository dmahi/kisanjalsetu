import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PAYMENT_METHOD, PAYMENT_REQUEST_STATUS, PAYMENT_STATUSES } from '../../common/constants';

export type PaymentDocument = Payment & Document;
export type PaymentRequestDocument = PaymentRequest & Document;

@Schema({ _id: false })
export class PaymentAllocation {
  @Prop({ type: Types.ObjectId, ref: 'WaterSession', required: true })
  waterSessionId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amountPaise: number;
}

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Tubewell', required: true, index: true })
  tubewellId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amountPaise: number;

  @Prop({ enum: Object.values(PAYMENT_METHOD), default: PAYMENT_METHOD.CASH })
  paymentMethod: string;

  @Prop({ required: true })
  paymentDate: Date;

  @Prop({ trim: true })
  referenceNumber?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ enum: Object.values(PAYMENT_STATUSES), default: PAYMENT_STATUSES.PENDING })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop()
  approvedAt?: Date;

  @Prop({ default: 'manual', enum: ['manual', 'payment_request'] })
  source: string;

  @Prop({ type: Types.ObjectId, ref: 'PaymentRequest' })
  paymentRequestId?: Types.ObjectId;

  @Prop({ type: [PaymentAllocation], default: [] })
  allocations: PaymentAllocation[];

  @Prop({ unique: true, sparse: true, index: true })
  idempotencyKey?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ tubewellId: 1, paymentDate: -1 });
PaymentSchema.index({ customerId: 1, paymentDate: -1 });

@Schema({ timestamps: true })
export class PaymentRequest {
  @Prop({ type: Types.ObjectId, ref: 'Tubewell', required: true, index: true })
  tubewellId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customerId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amountPaise: number;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ enum: Object.values(PAYMENT_REQUEST_STATUS), default: PAYMENT_REQUEST_STATUS.PENDING })
  status: string;

  @Prop({ default: new Date() })
  requestedAt: Date;

  @Prop()
  approvedAt?: Date;

  @Prop()
  rejectedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  processedBy?: Types.ObjectId;

  @Prop({ unique: true, sparse: true, index: true })
  idempotencyKey?: string;
}

export const PaymentRequestSchema = SchemaFactory.createForClass(PaymentRequest);
PaymentRequestSchema.index({ tubewellId: 1, status: 1 });
PaymentRequestSchema.index({ customerId: 1, status: 1 });
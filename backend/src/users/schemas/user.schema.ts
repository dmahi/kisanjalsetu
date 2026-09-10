import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role, USER_STATUS } from '../../common/constants';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, index: true, trim: true })
  phone: string;

  @Prop({ trim: true })
  email?: string;

  @Prop()
  passwordHash?: string;

  @Prop({ type: String, required: true, enum: ['admin', 'farmer', 'tubewell_owner', 'operator'], default: 'farmer' })
  role: Role;

  @Prop()
  profileImage?: string;

  @Prop({ enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE })
  status: string;

  @Prop()
  phoneVerifiedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  managedBy?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);
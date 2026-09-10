import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Field, FieldDocument } from './schemas/field.schema';

@Injectable()
export class FieldsService {
  constructor(@InjectModel(Field.name) private readonly fieldModel: Model<FieldDocument>) {}

  async listForCustomer(customerId: string): Promise<FieldDocument[]> {
    return this.fieldModel
      .find({ customerId: new Types.ObjectId(customerId), status: 'active' })
      .sort({ createdAt: -1 })
      .exec();
  }

  async create(customerId: string, data: { name: string; area?: number; areaUnit?: string; location?: string; notes?: string }): Promise<FieldDocument> {
    return this.fieldModel.create({ ...data, customerId: new Types.ObjectId(customerId) });
  }

  async update(customerId: string, fieldId: string, patch: Partial<Field>): Promise<FieldDocument> {
    const doc = await this.fieldModel
      .findOneAndUpdate({ _id: fieldId, customerId: new Types.ObjectId(customerId) }, patch, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('Field not found');
    return doc;
  }

  async remove(customerId: string, fieldId: string): Promise<void> {
    const res = await this.fieldModel
      .findOneAndDelete({ _id: fieldId, customerId: new Types.ObjectId(customerId) })
      .exec();
    if (!res) throw new NotFoundException('Field not found');
  }

  async findByIdForCustomer(customerId: string, fieldId: string): Promise<FieldDocument | null> {
    if (!fieldId.match(/^[0-9a-fA-F]{24}$/)) return null;
    return this.fieldModel.findOne({ _id: fieldId, customerId: new Types.ObjectId(customerId) }).exec();
  }
}
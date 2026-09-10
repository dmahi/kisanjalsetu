import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Crop, CropDocument } from './schemas/crop.schema';
import { DEFAULT_CROPS } from '../common/constants';

@Injectable()
export class CropsService implements OnModuleInit {
  constructor(@InjectModel(Crop.name) private readonly cropModel: Model<CropDocument>) {}

  async onModuleInit(): Promise<void> {
    for (const name of DEFAULT_CROPS) {
      const exists = await this.cropModel.findOne({ name }).exec();
      if (!exists) {
        await this.cropModel.create({ name });
      }
    }
  }

  async list(): Promise<CropDocument[]> {
    return this.cropModel.find({ status: 'active' }).sort({ name: 1 }).exec();
  }

  async findById(id: string): Promise<CropDocument | null> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) return null;
    return this.cropModel.findById(id).exec();
  }

  async ensure(idOrName: string): Promise<CropDocument> {
    if (idOrName.match(/^[0-9a-fA-F]{24}$/)) {
      const existing = await this.findById(idOrName);
      if (existing) return existing;
    }
    const name = idOrName.trim();
    const existing = await this.cropModel.findOne({ name }).exec();
    if (existing) return existing;
    return this.cropModel.create({ name });
  }
}
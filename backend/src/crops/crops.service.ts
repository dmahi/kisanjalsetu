import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Crop, CropDocument, CropLabels } from './schemas/crop.schema';
import { DEFAULT_CROPS, DEFAULT_CROP_LABELS } from '../common/constants';

@Injectable()
export class CropsService implements OnModuleInit {
  constructor(@InjectModel(Crop.name) private readonly cropModel: Model<CropDocument>) {}

  async onModuleInit(): Promise<void> {
    for (const name of DEFAULT_CROPS) {
      const exists = await this.cropModel.findOne({ name }).exec();
      if (!exists) {
        await this.cropModel.create({ name, labels: { en: name, ...DEFAULT_CROP_LABELS[name] } });
      } else if (!exists.labels?.hi && DEFAULT_CROP_LABELS[name]) {
        exists.labels = { en: name, ...DEFAULT_CROP_LABELS[name] };
        await exists.save();
      }
    }
  }

  async list(): Promise<CropDocument[]> {
    return this.cropModel.find({ status: 'active' }).sort({ name: 1 }).exec();
  }

  async adminList(): Promise<CropDocument[]> {
    return this.cropModel.find().sort({ name: 1 }).exec();
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
    return this.cropModel.create({ name, labels: { en: name } });
  }

  async adminCreate(data: { name: string; labels?: CropLabels }): Promise<CropDocument> {
    const name = data.name.trim();
    const existing = await this.cropModel.findOne({ name }).exec();
    if (existing) {
      if (data.labels) await this.adminUpdate(String(existing._id), { labels: data.labels });
      return existing;
    }
    return this.cropModel.create({ name, labels: { en: name, ...(data.labels || {}) } });
  }

  async adminUpdate(id: string, data: { name?: string; labels?: CropLabels; status?: 'active' | 'inactive' }): Promise<CropDocument> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new NotFoundException('Crop not found');
    const doc = await this.cropModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Crop not found');
    if (data.name !== undefined) doc.name = data.name.trim();
    if (data.labels) {
      doc.labels = { ...doc.labels, ...data.labels };
      doc.markModified('labels');
    }
    if (data.status !== undefined) doc.status = data.status;
    await doc.save();
    return doc;
  }

  async adminRemove(id: string): Promise<void> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new NotFoundException('Crop not found');
    const doc = await this.cropModel.findByIdAndUpdate(id, { status: 'inactive' }).exec();
    if (!doc) throw new NotFoundException('Crop not found');
  }
}
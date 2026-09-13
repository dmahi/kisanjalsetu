import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SelectOption, SelectOptionDocument } from './schemas/select-option.schema';
import { SELECT_OPTION_DEFAULTS, SELECT_OPTION_CATEGORIES } from './select-options.constants';

@Injectable()
export class SelectOptionsService implements OnModuleInit {
  constructor(
    @InjectModel(SelectOption.name)
    private readonly optionModel: Model<SelectOptionDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const seed of SELECT_OPTION_DEFAULTS) {
      const exists = await this.optionModel.findOne({ category: seed.category, code: seed.code }).exec();
      if (!exists) {
        await this.optionModel.create({
          category: seed.category,
          code: seed.code,
          labels: seed.labels,
          sortOrder: 0,
          active: true,
        });
      }
    }
  }

  async listByCategories(categories?: string[]): Promise<Record<string, SelectOptionDocument[]>> {
    const wanted = Array.isArray(categories) && categories.length > 0
      ? categories.filter((c) => SELECT_OPTION_CATEGORIES.includes((c as unknown) as (typeof SELECT_OPTION_CATEGORIES)[number]))
      : [...SELECT_OPTION_CATEGORIES];

    const docs = await this.optionModel
      .find({ category: { $in: wanted }, active: true })
      .sort({ sortOrder: 1 })
      .exec();

    const group: Record<string, SelectOptionDocument[]> = {};
    for (const category of wanted) group[category] = [];
    for (const doc of docs) {
      const list = group[doc.category];
      if (list) list.push(doc);
    }
    return group;
  }

  async adminList(category?: string): Promise<SelectOptionDocument[]> {
    const q = category ? { category } : {};
    return this.optionModel.find(q).sort({ category: 1, sortOrder: 1 }).exec();
  }

  async adminCreate(data: { category: string; code: string; labels: Record<string, string>; sortOrder?: number; active?: boolean }): Promise<SelectOptionDocument> {
    const existing = await this.optionModel.findOne({ category: data.category, code: data.code }).exec();
    if (existing) {
      existing.labels = { ...existing.labels, ...data.labels };
      if (data.sortOrder !== undefined) existing.sortOrder = data.sortOrder;
      if (data.active !== undefined) existing.active = data.active;
      await existing.save();
      return existing;
    }
    return this.optionModel.create({
      ...data,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
    });
  }

  async adminUpdate(
    id: string,
    data: { category?: string; code?: string; labels?: Record<string, string>; sortOrder?: number; active?: boolean },
  ): Promise<SelectOptionDocument> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new NotFoundException('Option not found');
    const doc = await this.optionModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Option not found');
    if (data.code !== undefined) doc.code = data.code;
    if (data.category !== undefined) doc.category = data.category;
    if (data.labels) {
      doc.labels = { ...doc.labels, ...data.labels };
      doc.markModified('labels');
    }
    if (data.sortOrder !== undefined) doc.sortOrder = data.sortOrder;
    if (data.active !== undefined) doc.active = data.active;
    await doc.save();
    return doc;
  }

  async adminRemove(id: string): Promise<void> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new NotFoundException('Option not found');
    const doc = await this.optionModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Option not found');
  }
}
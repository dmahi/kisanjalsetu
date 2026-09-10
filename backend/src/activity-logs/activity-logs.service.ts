import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActivityLog, ActivityLogDocument } from './schemas/activity-log.schema';

export interface LogEntry {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  description?: string;
  ipAddress?: string;
  session?: any;
}

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectModel(ActivityLog.name)
    private readonly logModel: Model<ActivityLogDocument>,
  ) {}

  async create(entry: LogEntry): Promise<ActivityLogDocument> {
    const doc: Record<string, unknown> = {
      userId: new Types.ObjectId(entry.userId),
      action: entry.action,
      entityType: entry.entityType || null,
      entityId: entry.entityId || null,
      oldValues: entry.oldValues || null,
      newValues: entry.newValues || null,
      description: entry.description || null,
      ipAddress: entry.ipAddress || null,
    };
    if (entry.session) doc['__session'] = entry.session;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.logModel.create(doc as any);
  }

  async list(filter: { userId?: string; entityType?: string; entityId?: string; limit?: number }): Promise<ActivityLogDocument[]> {
    const query: Record<string, unknown> = {};
    if (filter.userId) query.userId = new Types.ObjectId(filter.userId);
    if (filter.entityType) query.entityType = filter.entityType;
    if (filter.entityId) query.entityId = filter.entityId;
    return this.logModel.find(query as any).sort({ createdAt: -1 }).limit(filter.limit || 100).exec();
  }

  async count(): Promise<number> {
    return this.logModel.countDocuments().exec();
  }
}
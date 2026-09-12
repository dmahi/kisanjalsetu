import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  QUEUE_STATUS,
  WaterQueueEntry,
  WaterQueueEntryDocument,
} from './schemas/water-queue.schema';
import { TubewellsService } from '../tubewells/tubewells.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FieldsService } from '../fields/fields.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class WaterQueueService {
  constructor(
    @InjectModel(WaterQueueEntry.name)
    private readonly queueModel: Model<WaterQueueEntryDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly tubewellsService: TubewellsService,
    private readonly notificationsService: NotificationsService,
    private readonly fieldsService: FieldsService,
    private readonly usersService: UsersService,
  ) {}

  /** Normalize waiting queue positions to contiguous integers 1..N */
  async normalizeQueuePositions(tubewellId: string, session?: any): Promise<void> {
    const waitingEntries = await this.queueModel
      .find({
        tubewellId: new Types.ObjectId(tubewellId),
        status: QUEUE_STATUS.WAITING,
      })
      .sort({ queuePosition: 1, createdAt: 1 })
      .session(session || null)
      .exec();

    for (let i = 0; i < waitingEntries.length; i++) {
      const expectedPos = i + 1;
      if (waitingEntries[i].queuePosition !== expectedPos) {
        waitingEntries[i].queuePosition = expectedPos;
        await waitingEntries[i].save({ session: session || undefined });
      }
    }
  }

  /** Add an accepted request to the end of the tubewell queue */
  async addToQueue(dto: {
    tubewellId: string;
    waterRequestId: string;
    customerId: string;
    fieldId: string;
    cropId?: string;
    cropName?: string;
  }): Promise<WaterQueueEntryDocument> {
    const tubewell = await this.tubewellsService.findById(dto.tubewellId);
    const tubewellName = tubewell?.name || 'Tubewell';

    const waitingEntries = await this.queueModel
      .find({
        tubewellId: new Types.ObjectId(dto.tubewellId),
        status: QUEUE_STATUS.WAITING,
      })
      .sort({ queuePosition: -1 })
      .exec();

    const maxPos = waitingEntries.length > 0 ? waitingEntries[0].queuePosition : 0;
    const newPos = maxPos + 1;

    const entry = await this.queueModel.create({
      tubewellId: new Types.ObjectId(dto.tubewellId),
      waterRequestId: new Types.ObjectId(dto.waterRequestId),
      customerId: new Types.ObjectId(dto.customerId),
      fieldId: new Types.ObjectId(dto.fieldId),
      cropId: dto.cropId ? new Types.ObjectId(dto.cropId) : undefined,
      cropName: dto.cropName || undefined,
      queuePosition: newPos,
      status: QUEUE_STATUS.WAITING,
      queuedAt: new Date(),
    });

    // Notify farmer: Accepted + Queue position
    void this.notificationsService.create({
      userId: dto.customerId,
      title: 'Water Request Accepted',
      body: `Your water request has been accepted. You are currently #${newPos} in the queue for ${tubewellName}.`,
      type: 'water_request_accepted',
      data: {
        type: 'water_request_accepted',
        tubewell_id: dto.tubewellId,
        water_request_id: dto.waterRequestId,
        field_id: dto.fieldId,
        queue_position: String(newPos),
      },
    });

    if (newPos === 1) {
      void this.notificationsService.create({
        userId: dto.customerId,
        title: 'You Are Next!',
        body: `You are next for water at ${tubewellName}.`,
        type: 'queue_next',
        data: {
          type: 'queue_next',
          tubewell_id: dto.tubewellId,
          water_request_id: dto.waterRequestId,
          field_id: dto.fieldId,
        },
      });
    }

    return entry;
  }

  /** Get water queue for tubewell */
  async getQueueForTubewell(tubewellId: string): Promise<{
    active: any | null;
    waiting: any[];
    history: any[];
  }> {
    const tubewell = await this.tubewellsService.findById(tubewellId);
    const tubewellName = tubewell?.name || null;

    const activeDoc = await this.queueModel
      .findOne({
        tubewellId: new Types.ObjectId(tubewellId),
        status: QUEUE_STATUS.ACTIVE,
      })
      .exec();

    const waitingDocs = await this.queueModel
      .find({
        tubewellId: new Types.ObjectId(tubewellId),
        status: QUEUE_STATUS.WAITING,
      })
      .sort({ queuePosition: 1 })
      .exec();

    const historyDocs = await this.queueModel
      .find({
        tubewellId: new Types.ObjectId(tubewellId),
        status: { $in: [QUEUE_STATUS.COMPLETED, QUEUE_STATUS.REMOVED, QUEUE_STATUS.CANCELLED] },
      })
      .sort({ updatedAt: -1 })
      .limit(20)
      .exec();

    const populateEntry = async (entry: WaterQueueEntryDocument) => {
      const farmer = await this.usersService.findById(String(entry.customerId));
      const field = entry.fieldId
        ? await this.fieldsService.findByIdForCustomer(String(entry.customerId), String(entry.fieldId))
        : null;
      return {
        id: String(entry._id),
        tubewellId: String(entry.tubewellId),
        tubewellName,
        waterRequestId: String(entry.waterRequestId),
        customerId: String(entry.customerId),
        customerName: farmer?.name || null,
        customerPhone: farmer?.phone || null,
        fieldId: entry.fieldId ? String(entry.fieldId) : null,
        fieldName: field?.name || null,
        cropId: entry.cropId ? String(entry.cropId) : null,
        cropName: entry.cropName || null,
        queuePosition: entry.queuePosition,
        status: entry.status,
        queuedAt: entry.queuedAt,
        startedAt: entry.startedAt || null,
        completedAt: entry.completedAt || null,
        removedAt: entry.removedAt || null,
        createdAt: (entry as any).createdAt,
      };
    };

    const active = activeDoc ? await populateEntry(activeDoc) : null;
    const waiting = await Promise.all(waitingDocs.map(populateEntry));
    const history = await Promise.all(historyDocs.map(populateEntry));

    return { active, waiting, history };
  }

  /** Move entry up in queue (pos -> pos - 1) */
  async moveUp(ownerId: string, entryId: string): Promise<void> {
    const entry = await this.queueModel.findById(entryId).exec();
    if (!entry) throw new NotFoundException('Queue entry not found');
    await this.tubewellsService.ownerMustOwn(String(entry.tubewellId), ownerId);

    if (entry.status !== QUEUE_STATUS.WAITING) {
      throw new BadRequestException('Only waiting queue entries can be reordered');
    }

    const currentPos = entry.queuePosition;
    if (currentPos <= 1) return; // already at top

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const prevEntry = await this.queueModel
          .findOne({
            tubewellId: entry.tubewellId,
            status: QUEUE_STATUS.WAITING,
            queuePosition: currentPos - 1,
          })
          .session(session)
          .exec();

        if (prevEntry) {
          prevEntry.queuePosition = currentPos;
          await prevEntry.save({ session });
        }

        entry.queuePosition = currentPos - 1;
        await entry.save({ session });

        await this.normalizeQueuePositions(String(entry.tubewellId), session);
      });

      await this.notifyQueuePositionChanges(String(entry.tubewellId));
    } finally {
      await session.endSession();
    }
  }

  /** Move entry down in queue (pos -> pos + 1) */
  async moveDown(ownerId: string, entryId: string): Promise<void> {
    const entry = await this.queueModel.findById(entryId).exec();
    if (!entry) throw new NotFoundException('Queue entry not found');
    await this.tubewellsService.ownerMustOwn(String(entry.tubewellId), ownerId);

    if (entry.status !== QUEUE_STATUS.WAITING) {
      throw new BadRequestException('Only waiting queue entries can be reordered');
    }

    const currentPos = entry.queuePosition;
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const nextEntry = await this.queueModel
          .findOne({
            tubewellId: entry.tubewellId,
            status: QUEUE_STATUS.WAITING,
            queuePosition: currentPos + 1,
          })
          .session(session)
          .exec();

        if (!nextEntry) return; // already at bottom

        nextEntry.queuePosition = currentPos;
        await nextEntry.save({ session });

        entry.queuePosition = currentPos + 1;
        await entry.save({ session });

        await this.normalizeQueuePositions(String(entry.tubewellId), session);
      });

      await this.notifyQueuePositionChanges(String(entry.tubewellId));
    } finally {
      await session.endSession();
    }
  }

  /** Move entry to start of queue (position 1) */
  async moveToStart(ownerId: string, entryId: string): Promise<void> {
    const entry = await this.queueModel.findById(entryId).exec();
    if (!entry) throw new NotFoundException('Queue entry not found');
    await this.tubewellsService.ownerMustOwn(String(entry.tubewellId), ownerId);

    if (entry.status !== QUEUE_STATUS.WAITING) {
      throw new BadRequestException('Only waiting queue entries can be reordered');
    }

    const currentPos = entry.queuePosition;
    if (currentPos === 1) return; // already at start

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        // Shift items with position 1 .. currentPos - 1 up by +1
        await this.queueModel
          .updateMany(
            {
              tubewellId: entry.tubewellId,
              status: QUEUE_STATUS.WAITING,
              queuePosition: { $gte: 1, $lt: currentPos },
            },
            { $inc: { queuePosition: 1 } },
            { session },
          )
          .exec();

        entry.queuePosition = 1;
        await entry.save({ session });

        await this.normalizeQueuePositions(String(entry.tubewellId), session);
      });

      await this.notifyQueuePositionChanges(String(entry.tubewellId));
    } finally {
      await session.endSession();
    }
  }

  /** Move entry to end of queue */
  async moveToEnd(ownerId: string, entryId: string): Promise<void> {
    const entry = await this.queueModel.findById(entryId).exec();
    if (!entry) throw new NotFoundException('Queue entry not found');
    await this.tubewellsService.ownerMustOwn(String(entry.tubewellId), ownerId);

    if (entry.status !== QUEUE_STATUS.WAITING) {
      throw new BadRequestException('Only waiting queue entries can be reordered');
    }

    const currentPos = entry.queuePosition;
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const count = await this.queueModel
          .countDocuments({
            tubewellId: entry.tubewellId,
            status: QUEUE_STATUS.WAITING,
          })
          .session(session)
          .exec();

        if (currentPos >= count) return; // already at end

        // Shift items with position (currentPos + 1) .. count down by -1
        await this.queueModel
          .updateMany(
            {
              tubewellId: entry.tubewellId,
              status: QUEUE_STATUS.WAITING,
              queuePosition: { $gt: currentPos, $lte: count },
            },
            { $inc: { queuePosition: -1 } },
            { session },
          )
          .exec();

        entry.queuePosition = count;
        await entry.save({ session });

        await this.normalizeQueuePositions(String(entry.tubewellId), session);
      });

      await this.notifyQueuePositionChanges(String(entry.tubewellId));
    } finally {
      await session.endSession();
    }
  }

  /** Remove entry from queue */
  async remove(ownerId: string, entryId: string): Promise<void> {
    const entry = await this.queueModel.findById(entryId).exec();
    if (!entry) throw new NotFoundException('Queue entry not found');
    await this.tubewellsService.ownerMustOwn(String(entry.tubewellId), ownerId);

    if (entry.status !== QUEUE_STATUS.WAITING) {
      throw new BadRequestException('Only waiting queue entries can be removed');
    }

    const tubewell = await this.tubewellsService.findById(String(entry.tubewellId));
    const tubewellName = tubewell?.name || 'Tubewell';

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        entry.status = QUEUE_STATUS.REMOVED;
        entry.removedAt = new Date();
        await entry.save({ session });

        await this.normalizeQueuePositions(String(entry.tubewellId), session);
      });

      // Notify farmer about removal
      void this.notificationsService.create({
        userId: String(entry.customerId),
        title: 'Removed from Queue',
        body: `Your water request has been removed from the queue for ${tubewellName}.`,
        type: 'queue_removed',
        data: {
          type: 'queue_removed',
          tubewell_id: String(entry.tubewellId),
          water_request_id: String(entry.waterRequestId),
        },
      });

      await this.notifyQueuePositionChanges(String(entry.tubewellId));
    } finally {
      await session.endSession();
    }
  }

  /** Notify affected farmers of their current queue position */
  private async notifyQueuePositionChanges(tubewellId: string): Promise<void> {
    const tubewell = await this.tubewellsService.findById(tubewellId);
    const tubewellName = tubewell?.name || 'Tubewell';

    const waiting = await this.queueModel
      .find({
        tubewellId: new Types.ObjectId(tubewellId),
        status: QUEUE_STATUS.WAITING,
      })
      .sort({ queuePosition: 1 })
      .exec();

    for (const item of waiting) {
      void this.notificationsService.create({
        userId: String(item.customerId),
        title: 'Queue Position Updated',
        body: `Your water queue position has been updated. You are now #${item.queuePosition} for ${tubewellName}.`,
        type: 'queue_position_changed',
        data: {
          type: 'queue_position_changed',
          tubewell_id: tubewellId,
          queue_position: String(item.queuePosition),
        },
      });

      if (item.queuePosition === 1) {
        void this.notificationsService.create({
          userId: String(item.customerId),
          title: 'You Are Next!',
          body: `You are next for water at ${tubewellName}.`,
          type: 'queue_next',
          data: {
            type: 'queue_next',
            tubewell_id: tubewellId,
          },
        });
      }
    }
  }
}

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
import { TranslationService, type Locale } from '../i18n/translation.service';
import {
  WaterRequest,
  WaterRequestDocument,
} from '../water-requests/schemas/water-request.schema';
import {
  WaterSession,
  WaterSessionDocument,
} from '../sessions/schemas/water-session.schema';
import { SESSION_STATUS } from '../common/constants';
import { WaterGateway } from '../water/water.gateway';

@Injectable()
export class WaterQueueService {
  constructor(
    @InjectModel(WaterQueueEntry.name)
    private readonly queueModel: Model<WaterQueueEntryDocument>,
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(WaterRequest.name)
    private readonly requestModel: Model<WaterRequestDocument>,
    @InjectModel(WaterSession.name)
    private readonly sessionModel: Model<WaterSessionDocument>,
    private readonly tubewellsService: TubewellsService,
    private readonly notificationsService: NotificationsService,
    private readonly fieldsService: FieldsService,
    private readonly usersService: UsersService,
    private readonly translationService: TranslationService,
    private readonly waterGateway: WaterGateway,
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
    const farmer = await this.usersService.findById(dto.customerId);
    const locale = (farmer?.locale || 'en') as Locale;
    void this.notificationsService.create({
      userId: dto.customerId,
      title: this.translationService.translate('water_request_accepted_title', locale),
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
        title: this.translationService.translate('you_are_next_title', locale),
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

    await this.emitQueueChanged(dto.tubewellId, 'accepted');
    return entry;
  }

  async getQueueForTubewell(tubewellId: string): Promise<{
    active: any | null;
    waiting: any[];
    history: any[];
    generatedAt: Date;
  }> {
    const tubewell = await this.tubewellsService.findById(tubewellId);
    const tubewellName = tubewell?.name || null;

    const [activeDoc, waitingDocs, historyDocs, runningSession] = await Promise.all([
      this.queueModel
        .findOne({
          tubewellId: new Types.ObjectId(tubewellId),
          status: QUEUE_STATUS.ACTIVE,
        })
        .exec(),
      this.queueModel
        .find({
          tubewellId: new Types.ObjectId(tubewellId),
          status: QUEUE_STATUS.WAITING,
        })
        .sort({ queuePosition: 1 })
        .exec(),
      this.queueModel
        .find({
          tubewellId: new Types.ObjectId(tubewellId),
          status: { $in: [QUEUE_STATUS.COMPLETED, QUEUE_STATUS.REMOVED, QUEUE_STATUS.CANCELLED] },
        })
        .sort({ updatedAt: -1 })
        .limit(20)
        .exec(),
      this.sessionModel
        .findOne({
          tubewellId: new Types.ObjectId(tubewellId),
          status: SESSION_STATUS.RUNNING,
        })
        .exec(),
    ]);

    const liveEntries = [activeDoc, ...waitingDocs].filter(Boolean) as WaterQueueEntryDocument[];
    const requestIds = liveEntries.map((entry) => entry.waterRequestId);
    const requests = requestIds.length
      ? await this.requestModel.find({ _id: { $in: requestIds } }).exec()
      : [];
    const requestById = new Map(requests.map((request) => [String(request._id), request]));

    const now = new Date();
    let activeExpectedEnd: Date | null = null;
    if (runningSession?.estimatedEndDatetime) {
      activeExpectedEnd = new Date(runningSession.estimatedEndDatetime);
    } else if (runningSession?.estimatedDurationMinutes) {
      activeExpectedEnd = new Date(
        new Date(runningSession.startDatetime).getTime() + runningSession.estimatedDurationMinutes * 60000,
      );
    } else if (activeDoc) {
      const activeRequest = requestById.get(String(activeDoc.waterRequestId));
      if (activeRequest?.requestedDurationMinutes) {
        activeExpectedEnd = new Date(
          new Date(runningSession?.startDatetime || activeDoc.startedAt || now).getTime() +
            activeRequest.requestedDurationMinutes * 60000,
        );
      }
    }

    let accumulatedMs = activeExpectedEnd
      ? Math.max(0, activeExpectedEnd.getTime() - now.getTime())
      : 0;
    const waitingTimings = new Map<string, any>();

    for (const entry of waitingDocs) {
      const request = requestById.get(String(entry.waterRequestId));
      const durationMinutes = request?.requestedDurationMinutes || 0;
      const estimatedStartAt = new Date(now.getTime() + accumulatedMs);
      accumulatedMs += durationMinutes * 60000;
      waitingTimings.set(String(entry._id), {
        requestedDurationMinutes: request?.requestedDurationMinutes ?? null,
        estimatedWaitMinutes: Math.max(0, Math.ceil((estimatedStartAt.getTime() - now.getTime()) / 60000)),
        estimatedStartAt,
        expectedCompletionAt: durationMinutes
          ? new Date(estimatedStartAt.getTime() + durationMinutes * 60000)
          : null,
        etaAvailable: durationMinutes > 0,
      });
    }

    const populateEntry = async (
      entry: WaterQueueEntryDocument,
      timing: Record<string, unknown> = {},
    ) => {
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
        ...timing,
      };
    };

    const active = activeDoc
      ? await populateEntry(activeDoc, {
          requestedDurationMinutes: requestById.get(String(activeDoc.waterRequestId))?.requestedDurationMinutes ?? null,
          estimatedRemainingMinutes: activeExpectedEnd
            ? Math.max(0, Math.ceil((activeExpectedEnd.getTime() - now.getTime()) / 60000))
            : null,
          expectedCompletionAt: activeExpectedEnd,
          etaAvailable: Boolean(activeExpectedEnd),
          currentDelayReason: runningSession?.currentDelayReason || null,
        })
      : null;
    const waiting = await Promise.all(
      waitingDocs.map((entry) => populateEntry(entry, waitingTimings.get(String(entry._id)) || {})),
    );
    const history = await Promise.all(historyDocs.map((entry) => populateEntry(entry)));

    return { active, waiting, history, generatedAt: now };
  }

  async emitQueueChanged(tubewellId: string, reason: string): Promise<void> {
    if (!this.waterGateway) return;
    const queue = await this.getQueueForTubewell(tubewellId);
    this.waterGateway.emitWaterQueueChanged({
      tubewellId,
      reason,
      generatedAt: queue.generatedAt,
      active: queue.active
        ? {
            id: queue.active.id,
            customerId: queue.active.customerId,
            estimatedRemainingMinutes: queue.active.estimatedRemainingMinutes,
            expectedCompletionAt: queue.active.expectedCompletionAt,
            currentDelayReason: queue.active.currentDelayReason,
          }
        : null,
      waiting: queue.waiting.map((entry) => ({
        id: entry.id,
        waterRequestId: entry.waterRequestId,
        customerId: entry.customerId,
        queuePosition: entry.queuePosition,
        estimatedWaitMinutes: entry.estimatedWaitMinutes,
        estimatedStartAt: entry.estimatedStartAt,
        expectedCompletionAt: entry.expectedCompletionAt,
        etaAvailable: entry.etaAvailable,
      })),
    });
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
      await this.emitQueueChanged(String(entry.tubewellId), 'reordered');
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
      await this.emitQueueChanged(String(entry.tubewellId), 'reordered');
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
      await this.emitQueueChanged(String(entry.tubewellId), 'reordered');
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
      await this.emitQueueChanged(String(entry.tubewellId), 'reordered');
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
        await this.requestModel.updateOne(
          { _id: entry.waterRequestId, status: 'accepted' },
          { $set: { status: 'cancelled', cancelledAt: entry.removedAt } },
          { session },
        ).exec();

        await this.normalizeQueuePositions(String(entry.tubewellId), session);
      });

      // Notify farmer about removal
      const farmer = await this.usersService.findById(String(entry.customerId));
      const locale = (farmer?.locale || 'en') as Locale;
      void this.notificationsService.create({
        userId: String(entry.customerId),
        title: this.translationService.translate('removed_from_queue_title', locale),
        body: `Your water request has been removed from the queue for ${tubewellName}.`,
        type: 'queue_removed',
        data: {
          type: 'queue_removed',
          tubewell_id: String(entry.tubewellId),
          water_request_id: String(entry.waterRequestId),
        },
      });

      await this.notifyQueuePositionChanges(String(entry.tubewellId));
      await this.emitQueueChanged(String(entry.tubewellId), 'removed');
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
      const farmer = await this.usersService.findById(String(item.customerId));
      const locale = (farmer?.locale || 'en') as Locale;
      void this.notificationsService.create({
        userId: String(item.customerId),
        title: this.translationService.translate('queue_position_updated_title', locale),
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
          title: this.translationService.translate('you_are_next_title', locale),
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

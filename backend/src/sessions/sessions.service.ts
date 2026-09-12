import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import {
  WaterSession,
  WaterSessionDocument,
} from './schemas/water-session.schema';
import {
  WaterQueueEntry,
  WaterQueueEntryDocument,
  QUEUE_STATUS,
} from '../water-queue/schemas/water-queue.schema';
import {
  WaterRequest,
  WaterRequestDocument,
  WATER_REQUEST_STATUS,
} from '../water-requests/schemas/water-request.schema';
import { WaterQueueService } from '../water-queue/water-queue.service';
import { BillingService } from './billing.service';
import { TubewellsService } from '../tubewells/tubewells.service';
import { FieldsService } from '../fields/fields.service';
import { CropsService } from '../crops/crops.service';
import {
  PAYMENT_STATUS,
  SESSION_STATUS,
} from '../common/constants';
import { MoneyService } from '../common/money.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WaterGateway } from '../water/water.gateway';

export interface SessionFilters {
  tubewellId?: string;
  customerId?: string;
  fieldId?: string;
  cropId?: string;
  paymentStatus?: string;
  status?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(WaterSession.name)
    private readonly sessionModel: Model<WaterSessionDocument>,
    @InjectModel(WaterQueueEntry.name)
    private readonly queueModel: Model<WaterQueueEntryDocument>,
    @InjectModel(WaterRequest.name)
    private readonly requestModel: Model<WaterRequestDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly billing: BillingService,
    private readonly tubewellsService: TubewellsService,
    private readonly fieldsService: FieldsService,
    private readonly cropsService: CropsService,
    private readonly usersService: UsersService,
    private readonly money: MoneyService,
    private readonly logsService: ActivityLogsService,
    private readonly notificationsService: NotificationsService,
    private readonly waterQueueService: WaterQueueService,
    private readonly waterGateway: WaterGateway,
  ) {}

  async start(
    actorId: string,
    dto: {
      tubewellId: string;
      customerId?: string;
      fieldId?: string;
      cropId?: string;
      cropName?: string;
      startDatetime?: Date;
      idempotencyKey?: string;
      waterRequestId?: string;
      waterQueueEntryId?: string;
    },
  ): Promise<WaterSessionDocument> {
    const tubewell = await this.tubewellsService.ownerMustOwn(dto.tubewellId, actorId);

    // Look for queue entry if available or if no customer is passed
    let queueEntry: WaterQueueEntryDocument | null = null;
    if (dto.waterQueueEntryId) {
      queueEntry = await this.queueModel.findById(dto.waterQueueEntryId).exec();
    } else if (dto.customerId && dto.fieldId) {
      queueEntry = await this.queueModel
        .findOne({
          tubewellId: new Types.ObjectId(dto.tubewellId),
          customerId: new Types.ObjectId(dto.customerId),
          fieldId: new Types.ObjectId(dto.fieldId),
          status: QUEUE_STATUS.WAITING,
        })
        .sort({ queuePosition: 1 })
        .exec();
    } else if (!dto.customerId) {
      // Automatic queue selection: pick queue #1
      queueEntry = await this.queueModel
        .findOne({
          tubewellId: new Types.ObjectId(dto.tubewellId),
          status: QUEUE_STATUS.WAITING,
        })
        .sort({ queuePosition: 1 })
        .exec();
    }

    if (queueEntry) {
      dto.customerId = String(queueEntry.customerId);
      dto.fieldId = String(queueEntry.fieldId);
      dto.cropId = queueEntry.cropId ? String(queueEntry.cropId) : dto.cropId;
      dto.cropName = queueEntry.cropName || dto.cropName;
      dto.waterRequestId = String(queueEntry.waterRequestId);
    }

    if (!dto.customerId) {
      throw new BadRequestException('Select a farmer or ensure there is a farmer waiting in the queue.');
    }

    await this.tubewellsService.verifyApprovedMembership(dto.tubewellId, dto.customerId);
    if (!dto.fieldId) {
      throw new BadRequestException(
        'A field must be selected to start water. Ask the farmer to add their fields first.',
      );
    }
    await this.validateAux(dto.customerId, dto.fieldId, dto.cropId, dto.cropName);

    const startDatetime = dto.startDatetime ? new Date(dto.startDatetime) : new Date();

    const session = await this.connection.startSession();
    try {
      let result: WaterSessionDocument | null = null;
      await session.withTransaction(async () => {
        if (dto.idempotencyKey) {
          const existing = await this.sessionModel
            .findOne({ idempotencyKey: dto.idempotencyKey })
            .session(session)
            .exec();
          if (existing) {
            result = existing;
            return;
          }
        }
        const doc = await this.sessionModel.create(
          [
            {
              tubewellId: new Types.ObjectId(dto.tubewellId),
              customerId: new Types.ObjectId(dto.customerId),
              fieldId: dto.fieldId ? new Types.ObjectId(dto.fieldId) : undefined,
              cropId:
                dto.cropId && dto.cropId.match(/^[0-9a-fA-F]{24}$/)
                  ? new Types.ObjectId(dto.cropId)
                  : undefined,
              cropName: dto.cropName || undefined,
              waterRequestId: dto.waterRequestId ? new Types.ObjectId(dto.waterRequestId) : undefined,
              waterQueueEntryId: queueEntry ? queueEntry._id : undefined,
              startDatetime,
              status: SESSION_STATUS.RUNNING,
              ratePerHourPaise: tubewell.settings?.ratePerHourPaise ?? 0,
              grossAmountPaise: 0,
              discountAmountPaise: 0,
              finalAmountPaise: 0,
              paymentStatus: PAYMENT_STATUS.UNPAID,
              createdBy: new Types.ObjectId(actorId),
              idempotencyKey: dto.idempotencyKey || undefined,
              runningLock: new Types.ObjectId(dto.tubewellId),
            },
          ],
          { session },
        );
        result = doc[0];
      });
      if (!result) throw new BadRequestException('Unable to start session');

      if (queueEntry) {
        queueEntry.status = QUEUE_STATUS.ACTIVE;
        queueEntry.startedAt = startDatetime;
        queueEntry.waterSessionId = (result as WaterSessionDocument)._id;
        await queueEntry.save();
        await this.waterQueueService.normalizeQueuePositions(dto.tubewellId);
      }

      await this.logsService.create({
        userId: actorId,
        action: 'session_started',
        entityType: 'water_session',
        entityId: String((result as WaterSessionDocument)._id),
        newValues: { tubewellId: dto.tubewellId, customerId: dto.customerId },
        description: 'Started water session for customer',
      });
      await this.notifyFarmer(tubewell, result as WaterSessionDocument);
      this.waterGateway.emitWaterStarted(dto.tubewellId, {
        sessionId: String((result as WaterSessionDocument)._id),
        tubewellId: dto.tubewellId,
        tubewellName: tubewell.name,
        customerId: dto.customerId,
        fieldId: dto.fieldId,
        startTime: startDatetime,
        ratePerHour: this.money.paiseToRupees(tubewell.settings?.ratePerHourPaise ?? 0),
      });

      // Notify new top waiting farmer if any
      const nextWaiting = await this.queueModel
        .findOne({ tubewellId: new Types.ObjectId(dto.tubewellId), status: QUEUE_STATUS.WAITING })
        .sort({ queuePosition: 1 })
        .exec();
      if (nextWaiting) {
        void this.notificationsService.create({
          userId: String(nextWaiting.customerId),
          title: 'You Are Next!',
          body: `You are next for water at ${tubewell.name}.`,
          type: 'queue_next',
          data: { type: 'queue_next', tubewell_id: dto.tubewellId },
        });
      }

      return result;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('A water session is already running for this tubewell');
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async stop(actorId: string, sessionId: string, endDatetime?: Date): Promise<WaterSessionDocument> {
    const session = await this.findOwnedSession(actorId, sessionId);
    if (session.status !== SESSION_STATUS.RUNNING) {
      throw new BadRequestException('Session is not running');
    }
    const end = endDatetime ? new Date(endDatetime) : new Date();
    if (end.getTime() <= session.startDatetime.getTime()) {
      throw new BadRequestException('End time must be after start time');
    }

    const billing = this.billing.compute({
      start: session.startDatetime,
      end,
      settings: {
        ratePerHourPaise: session.ratePerHourPaise,
      },
    });

    const oldSnap = this.snapshot(session);
    session.endDatetime = end;
    session.durationMinutes = billing.durationMinutes;
    session.billableMinutes = billing.billableMinutes;
    session.grossAmountPaise = billing.grossPaise;
    session.finalAmountPaise = billing.finalPaise;
    session.discountAmountPaise = 0;
    session.status = SESSION_STATUS.COMPLETED;
    session.completedAt = end;
    session.updatedBy = new Types.ObjectId(actorId);
    session.runningLock = undefined;
    await session.save();

    await this.logsService.create({
      userId: actorId,
      action: 'session_stopped',
      entityType: 'water_session',
      entityId: String(session._id),
      oldValues: oldSnap,
      newValues: this.snapshot(session),
      description: `Stopped water. Duration ${billing.durationMinutes} min, bill ₹${this.money.paiseToRupees(billing.finalPaise)}`,
    });

    const stoppedTubewell = await this.tubewellsService.findById(String(session.tubewellId));
    this.waterGateway.emitWaterStopped(String(session.tubewellId), {
      sessionId: String(session._id),
      tubewellId: String(session.tubewellId),
      tubewellName: stoppedTubewell?.name || '',
      customerId: String(session.customerId),
      fieldId: session.fieldId ? String(session.fieldId) : undefined,
      startTime: session.startDatetime,
      endTime: end,
      durationMinutes: billing.durationMinutes,
      totalAmount: this.money.paiseToRupees(billing.finalPaise),
      ratePerHour: this.money.paiseToRupees(session.ratePerHourPaise),
    });

    await this.handleStopQueueAndNotifications(session, end, billing.durationMinutes, billing.finalPaise);

    return session;
  }

  /** Customer self-serve start. The customer must be an approved member of the
   *  tubewell; billing uses the tubewell's current rate. Only one running
   *  session per tubewell is allowed (runningLock partial unique index). */
  async startForCustomer(
    customerId: string,
    dto: {
      tubewellId: string;
      fieldId?: string;
      cropId?: string;
      cropName?: string;
      idempotencyKey?: string;
    },
  ): Promise<WaterSessionDocument> {
    await this.tubewellsService.verifyApprovedMembership(dto.tubewellId, customerId);
    const tubewell = await this.tubewellsService.findById(dto.tubewellId);
    if (!tubewell) throw new NotFoundException('Tubewell not found');
    await this.validateAux(customerId, dto.fieldId, dto.cropId, dto.cropName);

    const tx = await this.connection.startSession();
    try {
      let result: WaterSessionDocument | null = null;
      let created = false;
      await tx.withTransaction(async () => {
        if (dto.idempotencyKey) {
          const existing = await this.sessionModel
            .findOne({ idempotencyKey: dto.idempotencyKey })
            .session(tx)
            .exec();
          if (existing) {
            result = existing;
            return;
          }
        }
        const doc = await this.sessionModel.create(
          [
            {
              tubewellId: new Types.ObjectId(dto.tubewellId),
              customerId: new Types.ObjectId(customerId),
              fieldId: dto.fieldId ? new Types.ObjectId(dto.fieldId) : undefined,
              cropId:
                dto.cropId && dto.cropId.match(/^[0-9a-fA-F]{24}$/)
                  ? new Types.ObjectId(dto.cropId)
                  : undefined,
              cropName: dto.cropName || undefined,
              startDatetime: new Date(),
              status: SESSION_STATUS.RUNNING,
              ratePerHourPaise: tubewell.settings?.ratePerHourPaise ?? 0,
              grossAmountPaise: 0,
              discountAmountPaise: 0,
              finalAmountPaise: 0,
              paymentStatus: PAYMENT_STATUS.UNPAID,
              createdBy: new Types.ObjectId(customerId),
              idempotencyKey: dto.idempotencyKey || undefined,
              runningLock: new Types.ObjectId(dto.tubewellId),
            },
          ],
          { session: tx },
        );
        result = doc[0];
        created = true;
      });
      if (!result) throw new BadRequestException('Unable to start session');
      if (created) {
        await this.logsService.create({
          userId: customerId,
          action: 'session_started',
          entityType: 'water_session',
          entityId: String((result as WaterSessionDocument)._id),
          newValues: { tubewellId: dto.tubewellId },
          description: 'Customer started water (self-service)',
        });
        await this.notifyTubewellOwner(tubewell, result as WaterSessionDocument, 'session_started', 'Customer started water');
        this.waterGateway.emitWaterStarted(dto.tubewellId, {
          sessionId: String((result as WaterSessionDocument)._id),
          tubewellId: dto.tubewellId,
          tubewellName: tubewell.name,
          customerId,
          fieldId: dto.fieldId,
          startTime: new Date(),
          ratePerHour: this.money.paiseToRupees(tubewell.settings?.ratePerHourPaise ?? 0),
        });
      }
      return result;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('A water session is already running for this tubewell');
      }
      throw err;
    } finally {
      await tx.endSession();
    }
  }

  /** Customer self-serve stop. Only the customer who owns the running session
   *  (and is still an approved member) may stop it. */
  async stopForCustomer(
    customerId: string,
    sessionId: string,
    endDatetime?: Date,
  ): Promise<WaterSessionDocument> {
    const session = await this.findById(sessionId);
    if (!session) throw new NotFoundException('Water session not found');
    if (String(session.customerId) !== customerId) {
      throw new ForbiddenException('You do not have access to this session');
    }
    if (session.status !== SESSION_STATUS.RUNNING) {
      throw new BadRequestException('Session is not running');
    }

    const end = endDatetime ? new Date(endDatetime) : new Date();
    if (end.getTime() <= session.startDatetime.getTime()) {
      throw new BadRequestException('End time must be after start time');
    }

    const billing = this.billing.compute({
      start: session.startDatetime,
      end,
      settings: { ratePerHourPaise: session.ratePerHourPaise },
    });

    const oldSnap = this.snapshot(session);
    session.endDatetime = end;
    session.durationMinutes = billing.durationMinutes;
    session.billableMinutes = billing.billableMinutes;
    session.grossAmountPaise = billing.grossPaise;
    session.finalAmountPaise = billing.finalPaise;
    session.discountAmountPaise = 0;
    session.status = SESSION_STATUS.COMPLETED;
    session.completedAt = end;
    session.updatedBy = new Types.ObjectId(customerId);
    session.runningLock = undefined;
    await session.save();

    await this.logsService.create({
      userId: customerId,
      action: 'session_stopped',
      entityType: 'water_session',
      entityId: String(session._id),
      oldValues: oldSnap,
      newValues: this.snapshot(session),
      description: `Customer stopped water (self-service). Duration ${billing.durationMinutes} min, bill ₹${this.money.paiseToRupees(billing.finalPaise)}`,
    });

    const tubewell = await this.tubewellsService.findById(String(session.tubewellId));
    if (tubewell) {
      await this.notifyTubewellOwner(tubewell, session, 'session_stopped', 'Customer stopped water');
      this.waterGateway.emitWaterStopped(String(session.tubewellId), {
        sessionId: String(session._id),
        tubewellId: String(session.tubewellId),
        tubewellName: tubewell.name,
        customerId,
        fieldId: session.fieldId ? String(session.fieldId) : undefined,
        startTime: session.startDatetime,
        endTime: end,
        durationMinutes: billing.durationMinutes,
        totalAmount: this.money.paiseToRupees(billing.finalPaise),
        ratePerHour: this.money.paiseToRupees(session.ratePerHourPaise),
      });
    }

    await this.handleStopQueueAndNotifications(session, end, billing.durationMinutes, billing.finalPaise);

    return session;
  }

  private async notifyTubewellOwner(
    tubewell: any,
    session: WaterSessionDocument,
    type: string,
    title: string,
  ): Promise<void> {
    if (!tubewell?.ownerId) return;
    const customer = await this.usersService.findById(String(session.customerId));
    const customerName = customer?.name || 'Customer';
    const body =
      type === 'session_stopped'
        ? `${customerName} stopped water on ${tubewell.name} · ${session.durationMinutes ?? 0} min · ₹${this.money.paiseToRupees(session.finalAmountPaise)}`
        : `${customerName} started water on ${tubewell.name}`;
    await this.notificationsService.create({
      userId: String(tubewell.ownerId),
      title,
      body,
      type,
      data: {
        sessionId: String(session._id),
        tubewellId: String(session.tubewellId),
        customerId: String(session.customerId),
        customerName,
        tubewellName: tubewell.name,
        durationMinutes: session.durationMinutes ?? null,
        finalAmountPaise: session.finalAmountPaise ?? 0,
      },
    });
  }

  private async notifyFarmer(
    tubewell: any,
    session: WaterSessionDocument,
  ): Promise<void> {
    if (!session?.customerId) return;
    const farmer = await this.usersService.findById(String(session.customerId));
    if (!farmer) return;
    const body = `Water started on ${tubewell.name} for your field`;
    await this.notificationsService.create({
      userId: String(farmer._id),
      title: 'Water Started',
      body,
      type: 'water_started',
      data: {
        sessionId: String(session._id),
        tubewellId: String(session.tubewellId),
        tubewellName: tubewell.name,
        fieldId: session.fieldId ? String(session.fieldId) : null,
      },
    });
  }

  async createManual(
    actorId: string,
    dto: {
      tubewellId: string;
      customerId: string;
      fieldId?: string;
      cropId?: string;
      cropName?: string;
      startDatetime: Date;
      endDatetime: Date;
      discountType?: 'fixed' | 'percentage';
      discountValue?: number;
      discountReason?: string;
      idempotencyKey?: string;
    },
  ): Promise<WaterSessionDocument> {
    const tubewell = await this.tubewellsService.ownerMustOwn(dto.tubewellId, actorId);
    await this.tubewellsService.verifyApprovedMembership(dto.tubewellId, dto.customerId);
    await this.validateAux(dto.customerId, dto.fieldId, dto.cropId, dto.cropName);

    const start = new Date(dto.startDatetime);
    const end = new Date(dto.endDatetime);
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('End time must be after start time');
    }

    const settings = tubewell.settings ?? ({} as any);
    const billing = this.billing.compute({
      start,
      end,
      settings: {
        ratePerHourPaise: settings.ratePerHourPaise ?? 0,
      },
      discountType: dto.discountType,
      discountValue: dto.discountValue,
    });

    const session = await this.connection.startSession();
    try {
      let result: WaterSessionDocument | null = null;
      await session.withTransaction(async () => {
        if (dto.idempotencyKey) {
          const existing = await this.sessionModel
            .findOne({ idempotencyKey: dto.idempotencyKey })
            .session(session)
            .exec();
          if (existing) {
            result = existing;
            return;
          }
        }
        const conflict = await this.findOverlap(dto.tubewellId, start, end, undefined, session);
        if (conflict) {
          throw new ConflictException(
            `Time slot overlaps with an existing session (${String(conflict._id)})`,
          );
        }
        const doc = await this.sessionModel.create(
          [
            {
              tubewellId: new Types.ObjectId(dto.tubewellId),
              customerId: new Types.ObjectId(dto.customerId),
              fieldId: dto.fieldId ? new Types.ObjectId(dto.fieldId) : undefined,
              cropId:
                dto.cropId && dto.cropId.match(/^[0-9a-fA-F]{24}$/)
                  ? new Types.ObjectId(dto.cropId)
                  : undefined,
              cropName: dto.cropName || undefined,
              startDatetime: start,
              endDatetime: end,
              durationMinutes: billing.durationMinutes,
              billableMinutes: billing.billableMinutes,
              ratePerHourPaise: billing.ratePerHourPaise,
              grossAmountPaise: billing.grossPaise,
              discountAmountPaise: billing.discountPaise,
              discountType: billing.discountType || undefined,
              discountValue: billing.discountValue ?? undefined,
              discountReason: dto.discountReason || undefined,
              finalAmountPaise: billing.finalPaise,
              status: SESSION_STATUS.COMPLETED,
              paymentStatus: PAYMENT_STATUS.UNPAID,
              completedAt: end,
              createdBy: new Types.ObjectId(actorId),
              idempotencyKey: dto.idempotencyKey || undefined,
            },
          ],
          { session },
        );
        result = doc[0];
      });
      if (!result) throw new BadRequestException('Unable to create manual session');
      await this.logsService.create({
        userId: actorId,
        action: 'session_created_manual',
        entityType: 'water_session',
        entityId: String((result as WaterSessionDocument)._id),
        newValues: this.snapshot(result),
        description: 'Created manual water session',
      });
      return result;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('Duplicate session detected');
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async update(
    actorId: string,
    sessionId: string,
    dto: {
      startDatetime?: Date;
      endDatetime?: Date;
      discountType?: 'fixed' | 'percentage' | null;
      discountValue?: number | null;
      discountReason?: string;
      cropId?: string;
      cropName?: string;
    },
  ): Promise<WaterSessionDocument> {
    const session = await this.findOwnedSession(actorId, sessionId);
    if (session.status === SESSION_STATUS.CANCELLED) {
      throw new BadRequestException('Cancelled sessions cannot be edited');
    }

    const oldSnap = this.snapshot(session);
    const start = dto.startDatetime ? new Date(dto.startDatetime) : session.startDatetime;
    const end = dto.endDatetime ? new Date(dto.endDatetime) : session.endDatetime || new Date();
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('End time must be after start time');
    }

    const conflict = await this.findOverlap(String(session.tubewellId), start, end, sessionId);
    if (conflict) {
      throw new ConflictException('Updated time slot overlaps with another session');
    }

    const billing = this.billing.compute({
      start,
      end,
      settings: {
        ratePerHourPaise: session.ratePerHourPaise,
      },
      discountType: (dto.discountType ?? session.discountType) as 'fixed' | 'percentage' | null | undefined,
      discountValue: dto.discountValue ?? session.discountValue,
    });

    session.startDatetime = start;
    session.endDatetime = end;
    session.durationMinutes = billing.durationMinutes;
    session.billableMinutes = billing.billableMinutes;
    session.grossAmountPaise = billing.grossPaise;
    session.discountAmountPaise = billing.discountPaise;
    session.discountType = billing.discountType || undefined;
    session.discountValue = billing.discountValue ?? undefined;
    session.discountReason = dto.discountReason ?? session.discountReason;
    session.finalAmountPaise = billing.finalPaise;
    session.updatedBy = new Types.ObjectId(actorId);
    if (session.status === SESSION_STATUS.RUNNING) {
      session.runningLock = undefined;
    }
    if (dto.cropId) session.cropId = new Types.ObjectId(dto.cropId);
    if (dto.cropName) session.cropName = dto.cropName;
    if (session.status === SESSION_STATUS.RUNNING) {
      session.status = SESSION_STATUS.COMPLETED;
      session.completedAt = end;
    }
    await session.save();

    await this.logsService.create({
      userId: actorId,
      action: 'session_updated',
      entityType: 'water_session',
      entityId: String(session._id),
      oldValues: oldSnap,
      newValues: this.snapshot(session),
      description: 'Corrected session details (billing recalculated)',
    });

    return session;
  }

  async cancel(actorId: string, sessionId: string): Promise<WaterSessionDocument> {
    const session = await this.findOwnedSession(actorId, sessionId);
    if (session.status === SESSION_STATUS.CANCELLED) {
      throw new BadRequestException('Session already cancelled');
    }
    const oldSnap = this.snapshot(session);
    session.status = SESSION_STATUS.CANCELLED;
    session.runningLock = undefined;
    session.updatedBy = new Types.ObjectId(actorId);
    await session.save();
    await this.logsService.create({
      userId: actorId,
      action: 'session_cancelled',
      entityType: 'water_session',
      entityId: String(session._id),
      oldValues: oldSnap,
      newValues: this.snapshot(session),
      description: 'Cancelled water session',
    });
    return session;
  }

  async listForOwner(tubewellId: string, filters: SessionFilters = {}): Promise<WaterSessionDocument[]> {
    const query: Record<string, unknown> = { tubewellId: new Types.ObjectId(tubewellId) };
    this.applyFilters(query, filters);
    return this.sessionModel.find(query as any).sort({ startDatetime: -1 }).limit(filters.limit || 200).exec();
  }

  async listForCustomer(customerId: string, filters: SessionFilters = {}): Promise<WaterSessionDocument[]> {
    const query: Record<string, unknown> = { customerId: new Types.ObjectId(customerId) };
    if (filters.tubewellId) {
      query.tubewellId = new Types.ObjectId(filters.tubewellId);
    }
    this.applyFilters(query, filters);
    return this.sessionModel.find(query as any).sort({ startDatetime: -1 }).limit(filters.limit || 200).exec();
  }

  private applyFilters(query: Record<string, unknown>, filters: SessionFilters): void {
    if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
    if (filters.status) query.status = filters.status;
    if (filters.fieldId) query.fieldId = new Types.ObjectId(filters.fieldId);
    if (filters.cropId) query.cropId = new Types.ObjectId(filters.cropId);
    if (filters.customerId) query.customerId = new Types.ObjectId(filters.customerId);
    if (filters.from || filters.to) {
      query.startDatetime = {
        $gte: filters.from || new Date(0),
        $lte: filters.to || new Date(8640000000000000),
      };
    }
  }

  async findById(id: string): Promise<WaterSessionDocument | null> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) return null;
    return this.sessionModel.findById(id).exec();
  }

  async findOwnedSession(actorId: string, sessionId: string): Promise<WaterSessionDocument> {
    const session = await this.findById(sessionId);
    if (!session) throw new NotFoundException('Water session not found');
    const tubewell = await this.tubewellsService.findById(String(session.tubewellId));
    if (!tubewell || String(tubewell.ownerId) !== actorId) {
      throw new ForbiddenException('You do not have access to this session');
    }
    return session;
  }

  async findOverlap(
    tubewellId: string,
    start: Date,
    end: Date | null,
    excludeId?: string,
    session?: any,
  ): Promise<WaterSessionDocument | null> {
    const query: Record<string, unknown> = {
      tubewellId: new Types.ObjectId(tubewellId),
      status: { $in: [SESSION_STATUS.RUNNING, SESSION_STATUS.COMPLETED, SESSION_STATUS.DISPUTED] },
    };
    if (excludeId) query._id = { $ne: new Types.ObjectId(excludeId) };

    const candidates = await this.sessionModel
      .find(query as any)
      .session(session)
      .exec();

    for (const c of candidates) {
      const cEnd = c.endDatetime || new Date(8640000000000000);
      if (c.startDatetime.getTime() < (end || new Date(8640000000000000)).getTime() && cEnd.getTime() > start.getTime()) {
        return c;
      }
    }
    return null;
  }

  async runningForTubewell(tubewellId: string): Promise<WaterSessionDocument | null> {
    return this.sessionModel
      .findOne({ tubewellId: new Types.ObjectId(tubewellId), status: SESSION_STATUS.RUNNING })
      .exec();
  }

  async flagForgotten(tubewell: any): Promise<{ session: WaterSessionDocument; warning: string } | null> {
    const running = await this.runningForTubewell(String(tubewell._id));
    if (!running) return null;
    const maxMinutes = tubewell.settings?.maxSessionMinutes || 0;
    const elapsed = Math.round((Date.now() - running.startDatetime.getTime()) / 60000);
    let warning = '';
    if (maxMinutes > 0 && elapsed > maxMinutes) {
      warning = `Running past the ${maxMinutes} min maximum (${elapsed} min elapsed). Stop or correct the end time.`;
    }
    const opEnd = tubewell.settings?.operatingEndTime;
    if (opEnd && !warning) {
      const [h, m] = opEnd.split(':').map(Number);
      if (!Number.isNaN(h)) {
        const opEndDate = new Date(running.startDatetime);
        opEndDate.setHours(h, m || 0, 0, 0);
        if (running.startDatetime.getTime() < opEndDate.getTime() && Date.now() > opEndDate.getTime()) {
          warning = `Session has crossed operating end time (${opEnd}). Stop or correct it.`;
        }
      }
    }
    return { session: running, warning };
  }

  snapshot(session: WaterSessionDocument): Record<string, unknown> {
    return {
      startDatetime: session.startDatetime,
      endDatetime: session.endDatetime || null,
      durationMinutes: session.durationMinutes ?? null,
      ratePerHourPaise: session.ratePerHourPaise,
      grossAmountPaise: session.grossAmountPaise,
      discountAmountPaise: session.discountAmountPaise,
      discountType: session.discountType || null,
      finalAmountPaise: session.finalAmountPaise,
      status: session.status,
      paymentStatus: session.paymentStatus,
    };
  }

  async validateAux(customerId: string, fieldId?: string, cropId?: string, cropName?: string): Promise<void> {
    if (fieldId) {
      const field = await this.fieldsService.findByIdForCustomer(customerId, fieldId);
      if (!field) throw new BadRequestException('Field does not belong to this customer');
    }
    if (cropName && !cropId) {
      await this.cropsService.ensure(cropName);
    }
    if (cropId && cropId.match(/^[0-9a-fA-F]{24}$/)) {
      const crop = await this.cropsService.findById(cropId);
      if (!crop) throw new BadRequestException('Crop not found');
    }
  }

  async totalsForTubewell(tubewellId: string, filters: { from?: Date; to?: Date } = {}): Promise<{
    totalSessions: number;
    totalMinutes: number;
    totalBilledPaise: number;
    totalCollectedPaise: number;
    totalPendingPaise: number;
  }> {
    const match: Record<string, unknown> = {
      tubewellId: new Types.ObjectId(tubewellId),
      status: { $ne: SESSION_STATUS.CANCELLED },
    };
    if (filters.from || filters.to) {
      match.startDatetime = {
        $gte: filters.from || new Date(0),
        $lte: filters.to || new Date(8640000000000000),
      };
    }
    const agg = await this.sessionModel.aggregate([
      { $match: match as any },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalMinutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
          totalBilledPaise: { $sum: { $ifNull: ['$finalAmountPaise', 0] } },
          totalCollectedPaise: { $sum: { $ifNull: ['$paidAmountPaise', 0] } },
        },
      },
    ]);
    const row = agg[0] || {};
    return {
      totalSessions: row.totalSessions || 0,
      totalMinutes: row.totalMinutes || 0,
      totalBilledPaise: row.totalBilledPaise || 0,
      totalCollectedPaise: row.totalCollectedPaise || 0,
      totalPendingPaise: (row.totalBilledPaise || 0) - (row.totalCollectedPaise || 0),
    };
  }

  async totalsForCustomerForTubewell(customerId: string, tubewellId: string): Promise<{
    totalMinutes: number;
    totalBilledPaise: number;
    totalCollectedPaise: number;
    totalPendingPaise: number;
  }> {
    const agg = await this.sessionModel.aggregate([
      {
        $match: {
          customerId: new Types.ObjectId(customerId),
          tubewellId: new Types.ObjectId(tubewellId),
          status: { $ne: SESSION_STATUS.CANCELLED },
        },
      },
      {
        $group: {
          _id: null,
          totalMinutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
          totalBilledPaise: { $sum: { $ifNull: ['$finalAmountPaise', 0] } },
          totalCollectedPaise: { $sum: { $ifNull: ['$paidAmountPaise', 0] } },
        },
      },
    ]);
    const row = agg[0] || {};
    const billed = row.totalBilledPaise || 0;
    const collected = row.totalCollectedPaise || 0;
    return {
      totalMinutes: row.totalMinutes || 0,
      totalBilledPaise: billed,
      totalCollectedPaise: collected,
      totalPendingPaise: Math.max(0, billed - collected),
    };
  }

  async setSessionPaidState(sessionId: string, paidAmountPaise: number): Promise<WaterSessionDocument> {
    const session = await this.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    session.paidAmountPaise = Math.round(paidAmountPaise);
    if (session.paidAmountPaise >= session.finalAmountPaise && session.finalAmountPaise > 0) {
      session.paymentStatus = PAYMENT_STATUS.PAID;
    } else if (session.paidAmountPaise > 0) {
      session.paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
    } else {
      session.paymentStatus = PAYMENT_STATUS.UNPAID;
    }
    await session.save();
    return session;
  }

  async applyPayment(sessionId: string, amountPaise: number, mongoSession?: any): Promise<WaterSessionDocument> {
    const session = await this.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    session.paidAmountPaise = Math.round((session.paidAmountPaise || 0) + amountPaise);
    if (session.paidAmountPaise >= session.finalAmountPaise && session.finalAmountPaise > 0) {
      session.paymentStatus = PAYMENT_STATUS.PAID;
    } else if (session.paidAmountPaise > 0) {
      session.paymentStatus = PAYMENT_STATUS.PARTIALLY_PAID;
    } else {
      session.paymentStatus = PAYMENT_STATUS.UNPAID;
    }
    if (mongoSession) await session.save({ session: mongoSession });
    else await session.save();
    return session;
  }

  async getUsersMap(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const id of ids) {
      if (!id) continue;
      const user = await this.usersService.findById(id);
      if (user) map.set(id, user.name);
    }
    return map;
  }

  async countApprovedCustomers(tubewellId: string): Promise<number> {
    return this.tubewellsService.countApprovedMemberships(tubewellId);
  }

  private async handleStopQueueAndNotifications(
    session: WaterSessionDocument,
    end: Date,
    durationMinutes: number,
    finalAmountPaise: number,
  ): Promise<void> {
    const tubewell = await this.tubewellsService.findById(String(session.tubewellId));
    const tubewellName = tubewell?.name || 'Tubewell';
    const field = session.fieldId
      ? await this.fieldsService.findByIdForCustomer(String(session.customerId), String(session.fieldId))
      : null;

    // Find and complete active queue entry
    const qEntry = await this.queueModel
      .findOne({
        $or: [
          { waterSessionId: session._id },
          ...(session.waterQueueEntryId ? [{ _id: session.waterQueueEntryId }] : []),
          {
            tubewellId: session.tubewellId,
            customerId: session.customerId,
            status: QUEUE_STATUS.ACTIVE,
          },
        ],
      })
      .exec();

    if (qEntry) {
      qEntry.status = QUEUE_STATUS.COMPLETED;
      qEntry.completedAt = end;
      await qEntry.save();

      if (qEntry.waterRequestId) {
        await this.requestModel
          .updateOne(
            { _id: qEntry.waterRequestId },
            { status: WATER_REQUEST_STATUS.COMPLETED, completedAt: end },
          )
          .exec();
      }

      await this.waterQueueService.normalizeQueuePositions(String(session.tubewellId));
    }

    // Send mandatory Water Ended push notification
    void this.notificationsService.create({
      userId: String(session.customerId),
      title: 'Water Session Ended',
      body: `Your water session for ${field?.name || 'field'} has ended. Duration: ${durationMinutes} min, Amount: ₹${this.money.paiseToRupees(finalAmountPaise)}.`,
      type: 'water_ended',
      data: {
        type: 'water_ended',
        tubewell_id: String(session.tubewellId),
        water_session_id: String(session._id),
        field_id: session.fieldId ? String(session.fieldId) : '',
        duration_minutes: String(durationMinutes),
        amount: String(this.money.paiseToRupees(finalAmountPaise)),
      },
    });

    // Notify new queue #1 farmer if any
    const nextWaiting = await this.queueModel
      .findOne({ tubewellId: session.tubewellId, status: QUEUE_STATUS.WAITING })
      .sort({ queuePosition: 1 })
      .exec();
    if (nextWaiting) {
      void this.notificationsService.create({
        userId: String(nextWaiting.customerId),
        title: 'You Are Next!',
        body: `You are next for water at ${tubewellName}.`,
        type: 'queue_next',
        data: { type: 'queue_next', tubewell_id: String(session.tubewellId) },
      });
    }
  }
}
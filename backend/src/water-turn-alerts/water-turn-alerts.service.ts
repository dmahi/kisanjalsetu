import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Types } from 'mongoose';
import {
  WATER_TURN_STATUS,
  WaterTurnAlert,
  WaterTurnAlertDocument,
} from './schemas/water-turn-alert.schema';
import { WATER_TURN_RESPONSE } from './schemas/water-turn-alert.schema';
import {
  QUEUE_STATUS,
  WaterQueueEntry,
  WaterQueueEntryDocument,
} from '../water-queue/schemas/water-queue.schema';
import { SESSION_STATUS } from '../common/constants';
import {
  WaterSession,
  WaterSessionDocument,
} from '../sessions/schemas/water-session.schema';
import { TubewellsService } from '../tubewells/tubewells.service';
import { UsersService } from '../users/users.service';
import { FieldsService } from '../fields/fields.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { CreateWaterTurnAlertDto } from './dto/water-turn-alert.dto';

const ALERT_CHANNEL = 'water_turn';

@Injectable()
export class WaterTurnAlertsService {
  private readonly logger = new Logger('WaterTurnAlertsService');

  constructor(
    @InjectModel(WaterTurnAlert.name)
    private readonly alertModel: Model<WaterTurnAlertDocument>,
    @InjectModel(WaterQueueEntry.name)
    private readonly queueModel: Model<WaterQueueEntryDocument>,
    @InjectModel(WaterSession.name)
    private readonly sessionModel: Model<WaterSessionDocument>,
    private readonly config: ConfigService,
    private readonly tubewellsService: TubewellsService,
    private readonly usersService: UsersService,
    private readonly fieldsService: FieldsService,
    private readonly notificationsService: NotificationsService,
    private readonly logsService: ActivityLogsService,
  ) {}

  private get responseMinutes(): number {
    const m = Number(this.config.get<number>('WATER_TURN_RESPONSE_MINUTES', 5));
    return Number.isFinite(m) ? Math.min(60, Math.max(1, m)) : 5;
  }

  private get maxAttempts(): number {
    const n = Number(this.config.get<number>('WATER_TURN_MAX_ATTEMPTS', 3));
    return Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : 3;
  }

  /** Owner/operator manually notifies the first waiting farmer. */
  async createAlert(ownerId: string, dto: CreateWaterTurnAlertDto): Promise<any> {
    await this.tubewellsService.ownerMustOwn(dto.tubewellId, ownerId);

    const queueEntry = await this.queueModel
      .findOne({ tubewellId: new Types.ObjectId(dto.tubewellId), status: QUEUE_STATUS.WAITING })
      .sort({ queuePosition: 1 })
      .exec();
    if (!queueEntry) {
      throw new BadRequestException('Queue is empty — no farmer is waiting to notify');
    }

    // Idempotency: an active alert cycle for this tubewell already exists.
    const existing = await this.alertModel
      .findOne({
        tubewellId: new Types.ObjectId(dto.tubewellId),
        status: { $in: [WATER_TURN_STATUS.PENDING, WATER_TURN_STATUS.SENT, WATER_TURN_STATUS.ACKNOWLEDGED] },
      })
      .sort({ createdAt: -1 })
      .exec();
    if (existing) {
      return this.hydrate(existing);
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + this.responseMinutes * 60000);
    let doc: WaterTurnAlertDocument;
    try {
      doc = await this.alertModel.create({
        tubewellId: new Types.ObjectId(dto.tubewellId),
        waterQueueEntryId: new Types.ObjectId(queueEntry._id),
        waterRequestId: new Types.ObjectId(queueEntry.waterRequestId),
        fieldId: new Types.ObjectId(queueEntry.fieldId),
        cropId: queueEntry.cropId ? new Types.ObjectId(queueEntry.cropId) : undefined,
        cropName: queueEntry.cropName || undefined,
        targetCustomerId: new Types.ObjectId(queueEntry.customerId),
        estimatedRemainingMinutes: Math.max(0, Math.round(dto.estimatedRemainingMinutes ?? 0)),
        attemptNumber: 1,
        maxAttempts: this.maxAttempts,
        status: WATER_TURN_STATUS.SENT,
        sentAt: now,
        responseDeadlineAt: deadline,
        activeFlag: 'active',
        sentBy: new Types.ObjectId(ownerId),
        createdBy: new Types.ObjectId(ownerId),
      });
    } catch (err: any) {
      // Duplicate active cycle race — return the winner (spec §17 Case 4).
      if (err?.code === 11000) {
        const active = await this.alertModel
          .findOne({
            tubewellId: new Types.ObjectId(dto.tubewellId),
            activeFlag: 'active',
          })
          .exec();
        if (active) return this.hydrate(active);
        throw err;
      }
      throw err;
    }

    await this.pushToFarmer(doc, 'water_turn_alert', 'Your Water Turn Is Starting');
    await this.logsService.create({
      userId: ownerId,
      action: 'water_turn_alert_sent',
      entityType: 'water_turn_alert',
      entityId: String(doc._id),
      newValues: {
        tubewellId: dto.tubewellId,
        waterQueueEntryId: String(queueEntry._id),
        responseMinutes: this.responseMinutes,
      },
      description: `Notified next farmer in queue to get ready`,
    });

    return this.hydrate(doc);
  }

  /** Owner/operator view of one alert, or farmer acknowledge-on-open. */
  async getAlert(actorId: string, alertId: string, role: string): Promise<any> {
    const doc = await this.alertModel.findById(alertId).exec();
    if (!doc) throw new NotFoundException('Water turn alert not found');

    if (role === 'farmer') {
      if (String(doc.targetCustomerId) !== actorId) {
        throw new ForbiddenException('You do not have access to this alert');
      }
      // Opening the alert acknowledges it — stops re-prompts, keeps deadline.
      if (doc.status === WATER_TURN_STATUS.SENT) {
        doc.status = WATER_TURN_STATUS.ACKNOWLEDGED;
        await doc.save();
      }
    } else {
      await this.tubewellsService.ownerMustOwn(String(doc.tubewellId), actorId);
    }
    return this.hydrate(doc);
  }

  /** Farmer answers READY / NOT_READY. Atomic — concurrent responses & the
   *  scheduler race lose cleanly (one winner, spec §17 Cases 3 & 5). */
  async respond(
    actorId: string,
    alertId: string,
    dto: { response: string; note?: string },
  ): Promise<any> {
    const doc = await this.alertModel.findById(alertId).exec();
    if (!doc) throw new NotFoundException('Water turn alert not found');
    if (String(doc.targetCustomerId) !== actorId) {
      throw new ForbiddenException('You do not have access to this alert');
    }
    if (doc.status !== WATER_TURN_STATUS.SENT && doc.status !== WATER_TURN_STATUS.ACKNOWLEDGED) {
      throw new ConflictException(`Alert is already ${doc.status}`);
    }
    if (typeof doc.responseDeadlineAt === 'undefined' || doc.responseDeadlineAt.getTime() < Date.now()) {
      throw new ConflictException('Alert response window has expired');
    }

    const response = dto.response;
    const updated = await this.alertModel
      .findOneAndUpdate(
        {
          _id: doc._id,
          status: { $in: [WATER_TURN_STATUS.SENT, WATER_TURN_STATUS.ACKNOWLEDGED] },
        },
        {
          $set: {
            status: response === WATER_TURN_RESPONSE.READY ? WATER_TURN_STATUS.READY : WATER_TURN_STATUS.NOT_READY,
            response,
            respondedAt: new Date(),
            responseNote: dto.note?.trim() || undefined,
          },
          $unset: { activeFlag: 1 },
        },
        { new: true },
      )
      .exec();
    if (!updated) throw new ConflictException('Alert was already responded or expired');

    const isReady = response === WATER_TURN_RESPONSE.READY;
    await this.notifyOwner(
      updated,
      isReady ? 'water_turn_ready' : 'water_turn_not_ready',
      isReady ? 'Farmer Is Ready' : 'Farmer Not Ready',
    );
    await this.logsService.create({
      userId: actorId,
      action: 'water_turn_alert_responded',
      entityType: 'water_turn_alert',
      entityId: String(updated._id),
      newValues: { response },
      description: `Farmer replied ${isReady ? 'READY' : 'NOT READY'}`,
    });

    return this.hydrate(updated);
  }

  /** "Alert Again" — starts a fresh attempt cycle for the same next farmer
   *  after a NOT_READY / NO_RESPONSE outcome. Owner keeps full control. */
  async manualRetry(ownerId: string, alertId: string): Promise<any> {
    const doc = await this.alertModel.findById(alertId).exec();
    if (!doc) throw new NotFoundException('Water turn alert not found');
    await this.tubewellsService.ownerMustOwn(String(doc.tubewellId), ownerId);
    if (doc.status !== WATER_TURN_STATUS.NOT_READY && doc.status !== WATER_TURN_STATUS.NO_RESPONSE) {
      throw new BadRequestException(
        `Cannot retry an alert in "${doc.status}" state. Alert Again is available after NOT READY or NO RESPONSE.`,
      );
    }

    const now = new Date();
    const deadline = new Date(now.getTime() + this.responseMinutes * 60000);
    const updated = await this.alertModel
      .findOneAndUpdate(
        {
          _id: doc._id,
          status: { $in: [WATER_TURN_STATUS.NOT_READY, WATER_TURN_STATUS.NO_RESPONSE] },
        },
        {
          $set: {
            status: WATER_TURN_STATUS.SENT,
            attemptNumber: 1,
            sentAt: now,
            responseDeadlineAt: deadline,
            activeFlag: 'active',
          },
          $unset: { response: 1, respondedAt: 1, responseNote: 1, noResponseAt: 1 },
        },
        { new: true },
      )
      .exec();
    if (!updated) throw new ConflictException('Alert was already retried');

    await this.pushToFarmer(updated, 'water_turn_alert_retry', 'Water Turn — Please Confirm Again');
    await this.logsService.create({
      userId: ownerId,
      action: 'water_turn_alert_retried',
      entityType: 'water_turn_alert',
      entityId: String(updated._id),
      description: 'Owner re-notified next farmer (Alert Again)',
    });

    return this.hydrate(updated);
  }

  /** Owner cancels an alert cycle without touching the queue. */
  async cancelAlert(ownerId: string, alertId: string, reason?: string): Promise<any> {
    const doc = await this.alertModel.findById(alertId).exec();
    if (!doc) throw new NotFoundException('Water turn alert not found');
    await this.tubewellsService.ownerMustOwn(String(doc.tubewellId), ownerId);

    const updated = await this.alertModel
      .findOneAndUpdate(
        { _id: doc._id, status: { $ne: WATER_TURN_STATUS.CANCELLED } },
        {
          $set: { status: WATER_TURN_STATUS.CANCELLED, cancelledAt: new Date(), cancelledReason: reason?.trim() || undefined },
          $unset: { activeFlag: 1 },
        },
        { new: true },
      )
      .exec();
    if (!updated) throw new ConflictException('Alert is already cancelled');

    await this.logsService.create({
      userId: ownerId,
      action: 'water_turn_alert_cancelled',
      entityType: 'water_turn_alert',
      entityId: String(updated._id),
      newValues: { cancelledReason: reason || null },
      description: 'Owner cancelled the water turn alert',
    });

    return this.hydrate(updated);
  }

  /** Owner: alerts history + live state for a tubewell. */
  async listForOwner(ownerId: string, tubewellId: string): Promise<any[]> {
    await this.tubewellsService.ownerMustOwn(tubewellId, ownerId);
    const docs = await this.alertModel
      .find({ tubewellId: new Types.ObjectId(tubewellId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    return Promise.all(docs.map((d) => this.hydrate(d)));
  }

  /** Farmer: alerts targeted at them (live + recent history). */
  async listForFarmer(actorId: string, tubewellId?: string): Promise<any[]> {
    const query: Record<string, unknown> = { targetCustomerId: new Types.ObjectId(actorId) };
    if (tubewellId) query.tubewellId = new Types.ObjectId(tubewellId);
    const docs = await this.alertModel
      .find(query as any)
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    return Promise.all(docs.map((d) => this.hydrate(d)));
  }

  /** Live "next farmer + active alert" payload for a tubewell. */
  async getNextForTubewell(
    actorId: string,
    tubewellId: string,
    role: string,
  ): Promise<any> {
    if (role === 'farmer') {
      await this.tubewellsService.verifyApprovedMembership(tubewellId, actorId);
    } else {
      await this.tubewellsService.ownerMustOwn(tubewellId, actorId);
    }

    const entry = await this.queueModel
      .findOne({ tubewellId: new Types.ObjectId(tubewellId), status: QUEUE_STATUS.WAITING })
      .sort({ queuePosition: 1 })
      .exec();

    let alert: any = null;
    if (entry) {
      const doc = await this.alertModel
        .findOne({
          waterQueueEntryId: new Types.ObjectId(entry._id),
          status: { $in: [WATER_TURN_STATUS.PENDING, WATER_TURN_STATUS.SENT, WATER_TURN_STATUS.ACKNOWLEDGED] },
        })
        .sort({ createdAt: -1 })
        .exec();
      if (doc) alert = await this.hydrate(doc);
    }

    let next: any = null;
    if (entry) {
      const farmer = await this.usersService.findById(String(entry.customerId));
      const field = entry.fieldId
        ? await this.fieldsService.findByIdForCustomer(String(entry.customerId), String(entry.fieldId))
        : null;
      next = {
        id: String(entry._id),
        waterRequestId: String(entry.waterRequestId),
        customerId: String(entry.customerId),
        customerName: farmer?.name || null,
        customerPhone: farmer?.phone || null,
        fieldId: entry.fieldId ? String(entry.fieldId) : null,
        fieldName: field?.name || null,
        cropId: entry.cropId ? String(entry.cropId) : null,
        cropName: entry.cropName || null,
        queuePosition: entry.queuePosition,
      };
    }

    return { next, alert };
  }

  /**
   * Backend-authoritative scheduler tick: expire response windows (spec §13).
   * - attempts remaining → re-send (attemptNumber+1, new 5-minute window)
   * - no attempts left → NO_RESPONSE + notify owner
   * Also fires the water_turn_delayed notice when the current session overruns
   * the owner's estimate + 5-minute buffer.
   */
  async processExpired(): Promise<void> {
    const now = Date.now();

    const due = await this.alertModel
      .find({
        status: WATER_TURN_STATUS.SENT,
        respondedAt: { $exists: false },
        responseDeadlineAt: { $lte: new Date(now) },
      })
      .exec();

    for (const doc of due) {
      if (doc.attemptNumber >= doc.maxAttempts) {
        const updated = await this.alertModel
          .findOneAndUpdate(
            {
              _id: doc._id,
              status: WATER_TURN_STATUS.SENT,
              respondedAt: { $exists: false },
            },
            {
              $set: { status: WATER_TURN_STATUS.NO_RESPONSE, noResponseAt: new Date(now) },
              $unset: { activeFlag: 1 },
            },
            { new: true },
          )
          .exec();
        if (!updated) continue; // farmer responded meanwhile
        await this.notifyOwner(updated, 'water_turn_no_response', 'Farmer Did Not Respond');
        await this.logsService.create({
          userId: String(updated.sentBy || updated.createdBy || updated.tubewellId),
          action: 'water_turn_alert_no_response',
          entityType: 'water_turn_alert',
          entityId: String(updated._id),
          description: `No response after ${updated.maxAttempts} attempts`,
        });
      } else {
        const nextDeadline = new Date(now + this.responseMinutes * 60000);
        const updated = await this.alertModel
          .findOneAndUpdate(
            {
              _id: doc._id,
              status: WATER_TURN_STATUS.SENT,
              respondedAt: { $exists: false },
            },
            {
              $set: {
                status: WATER_TURN_STATUS.SENT,
                attemptNumber: doc.attemptNumber + 1,
                sentAt: new Date(now),
                responseDeadlineAt: nextDeadline,
              },
            },
            { new: true },
          )
          .exec();
        if (!updated) continue;
        await this.pushToFarmer(updated, 'water_turn_alert_retry', 'Water Turn — Please Confirm Now');
        await this.logsService.create({
          userId: String(updated.sentBy || updated.createdBy || updated.tubewellId),
          action: 'water_turn_alert_retry',
          entityType: 'water_turn_alert',
          entityId: String(updated._id),
          newValues: { attemptNumber: updated.attemptNumber },
          description: `Re-sent alert for farmer (attempt ${updated.attemptNumber}/${updated.maxAttempts})`,
        });
      }
    }

    // Delay detection: current session has exceeded estimate + buffer.
    const live = await this.alertModel
      .find({
        status: WATER_TURN_STATUS.SENT,
        delayNotifiedAt: null,
        estimatedRemainingMinutes: { $gt: 0 },
      })
      .exec();
    for (const doc of live) {
      const running = await this.sessionModel
        .findOne({
          tubewellId: doc.tubewellId,
          status: SESSION_STATUS.RUNNING,
        })
        .exec();
      if (!running) continue;
      const overrunAt =
        new Date(running.startDatetime).getTime() + (doc.estimatedRemainingMinutes + 5) * 60000;
      if (Date.now() <= overrunAt) continue;

      const updated = await this.alertModel
        .findOneAndUpdate(
          { _id: doc._id, status: WATER_TURN_STATUS.SENT, delayNotifiedAt: null },
          { $set: { delayNotifiedAt: new Date(now) } },
          { new: true },
        )
        .exec();
      if (!updated) continue;
      await this.pushToFarmer(updated, 'water_turn_delayed', 'Water Is Running Late');
    }
  }

  private async pushToFarmer(
    doc: WaterTurnAlertDocument,
    type: string,
    title: string,
  ): Promise<void> {
    const farmer = await this.usersService.findById(String(doc.targetCustomerId));
    const field = doc.fieldId
      ? await this.fieldsService.findByIdForCustomer(String(doc.targetCustomerId), String(doc.fieldId))
      : null;
    const t = await this.tubewellsService.findById(String(doc.tubewellId));

    await this.notificationsService
      .create({
        userId: String(doc.targetCustomerId),
        title,
        body: `You're next for water at ${t?.name || 'the tubewell'}. Please confirm READY or NOT READY within ${this.responseMinutes} minutes.${
          field?.name ? ` Field: ${field.name}` : ''
        }`,
        type,
        channel: ALERT_CHANNEL,
        priority: 'high',
        data: {
          type,
          water_turn_alert_id: String(doc._id),
          tubewell_id: String(doc.tubewellId),
          tubewell_name: t?.name || '',
          water_queue_entry_id: String(doc.waterQueueEntryId),
          water_request_id: doc.waterRequestId ? String(doc.waterRequestId) : '',
          field_id: doc.fieldId ? String(doc.fieldId) : '',
          field_name: field?.name || '',
          farmer_id: String(doc.targetCustomerId),
          farmer_name: farmer?.name || '',
          response_minutes: String(this.responseMinutes),
          response_deadline: doc.responseDeadlineAt ? doc.responseDeadlineAt.toISOString() : '',
          attempt_number: String(doc.attemptNumber),
          max_attempts: String(doc.maxAttempts),
          estimated_remaining_minutes: String(doc.estimatedRemainingMinutes),
        },
      })
      .catch((err) => {
        this.logger.warn(`water_turn push to farmer failed (${type}): ${err?.message || err}`);
      });
  }

  private async notifyOwner(
    doc: WaterTurnAlertDocument,
    type: string,
    title: string,
  ): Promise<void> {
    const t = await this.tubewellsService.findById(String(doc.tubewellId));
    if (!t?.ownerId) return;
    const farmer = await this.usersService.findById(String(doc.targetCustomerId));

    await this.notificationsService
      .create({
        userId: String(t.ownerId),
        title,
        body: `${farmer?.name || 'Farmer'} (${
          type === 'water_turn_no_response' ? 'no response' : doc.response === 'ready' ? 'READY' : 'NOT READY'
        }) · ${t.name}`,
        type,
        channel: ALERT_CHANNEL,
        priority: 'high',
        data: {
          type,
          water_turn_alert_id: String(doc._id),
          tubewell_id: String(doc.tubewellId),
          tubewell_name: t.name,
          water_queue_entry_id: String(doc.waterQueueEntryId),
          farmer_id: String(doc.targetCustomerId),
          farmer_name: farmer?.name || '',
          field_id: doc.fieldId ? String(doc.fieldId) : '',
          response: doc.response || '',
          attempt_number: String(doc.attemptNumber),
        },
      })
      .catch((err) => {
        this.logger.warn(`water_turn push to owner failed (${type}): ${err?.message || err}`);
      });
  }

  private async hydrate(doc: WaterTurnAlertDocument): Promise<any> {
    const t = await this.tubewellsService.findById(String(doc.tubewellId));
    const farmer = await this.usersService.findById(String(doc.targetCustomerId));
    const field = doc.fieldId
      ? await this.fieldsService.findByIdForCustomer(String(doc.targetCustomerId), String(doc.fieldId))
      : null;

    let remainingSeconds = 0;
    if (
      (doc.status === WATER_TURN_STATUS.SENT || doc.status === WATER_TURN_STATUS.ACKNOWLEDGED) &&
      doc.responseDeadlineAt
    ) {
      remainingSeconds = Math.max(0, Math.floor((doc.responseDeadlineAt.getTime() - Date.now()) / 1000));
    }

    return {
      id: String(doc._id),
      tubewellId: String(doc.tubewellId),
      tubewellName: t?.name || null,
      waterQueueEntryId: String(doc.waterQueueEntryId),
      waterRequestId: doc.waterRequestId ? String(doc.waterRequestId) : null,
      waterSessionId: doc.waterSessionId ? String(doc.waterSessionId) : null,
      targetCustomerId: String(doc.targetCustomerId),
      farmerName: farmer?.name || null,
      farmerPhone: farmer?.phone || null,
      fieldId: doc.fieldId ? String(doc.fieldId) : null,
      fieldName: field?.name || null,
      cropId: doc.cropId ? String(doc.cropId) : null,
      cropName: doc.cropName || null,
      estimatedRemainingMinutes: doc.estimatedRemainingMinutes,
      attemptNumber: doc.attemptNumber,
      maxAttempts: doc.maxAttempts,
      status: doc.status,
      sentAt: doc.sentAt || null,
      responseDeadlineAt: doc.responseDeadlineAt || null,
      respondedAt: doc.respondedAt || null,
      response: doc.response || null,
      responseNote: doc.responseNote || null,
      noResponseAt: doc.noResponseAt || null,
      delayNotifiedAt: doc.delayNotifiedAt || null,
      cancelledAt: doc.cancelledAt || null,
      cancelledReason: doc.cancelledReason || null,
      sentBy: doc.sentBy ? String(doc.sentBy) : null,
      createdBy: doc.createdBy ? String(doc.createdBy) : null,
      remainingSeconds,
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
  }
}
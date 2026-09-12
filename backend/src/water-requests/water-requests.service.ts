import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WATER_REQUEST_STATUS,
  WaterRequest,
  WaterRequestDocument,
} from './schemas/water-request.schema';
import { CreateWaterRequestDto, RejectWaterRequestDto } from './dto/water-request.dto';
import { TubewellsService } from '../tubewells/tubewells.service';
import { FieldsService } from '../fields/fields.service';
import { CropsService } from '../crops/crops.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WaterQueueService } from '../water-queue/water-queue.service';
import { WaterQueueEntry, WaterQueueEntryDocument, QUEUE_STATUS } from '../water-queue/schemas/water-queue.schema';
import { WaterSession, WaterSessionDocument } from '../sessions/schemas/water-session.schema';
import { PAYMENT_STATUS } from '../common/constants';
import { MoneyService } from '../common/money.service';

@Injectable()
export class WaterRequestsService {
  constructor(
    @InjectModel(WaterRequest.name)
    private readonly requestModel: Model<WaterRequestDocument>,
    @InjectModel(WaterQueueEntry.name)
    private readonly queueModel: Model<WaterQueueEntryDocument>,
    @InjectModel(WaterSession.name)
    private readonly sessionModel: Model<WaterSessionDocument>,
    private readonly tubewellsService: TubewellsService,
    private readonly fieldsService: FieldsService,
    private readonly cropsService: CropsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly waterQueueService: WaterQueueService,
    private readonly money: MoneyService,
  ) {}

  /** Farmer creates a new water request */
  async createRequest(
    customerId: string,
    dto: CreateWaterRequestDto,
  ): Promise<WaterRequestDocument> {
    await this.tubewellsService.verifyApprovedMembership(dto.tubewellId, customerId);

    const field = await this.fieldsService.findByIdForCustomer(customerId, dto.fieldId);
    if (!field) throw new BadRequestException('Field not found or does not belong to farmer');

    let cropName = dto.cropName?.trim();
    if (dto.cropId) {
      const crop = await this.cropsService.findById(dto.cropId);
      if (crop) cropName = crop.name;
    }

    const doc = await this.requestModel.create({
      tubewellId: new Types.ObjectId(dto.tubewellId),
      customerId: new Types.ObjectId(customerId),
      fieldId: new Types.ObjectId(dto.fieldId),
      cropId: dto.cropId ? new Types.ObjectId(dto.cropId) : undefined,
      cropName: cropName || undefined,
      requestedDurationMinutes: Math.round(dto.requestedDurationMinutes),
      requestedDate: dto.requestedDate ? new Date(dto.requestedDate) : new Date(),
      preferredStartTime: dto.preferredStartTime || undefined,
      preferredEndTime: dto.preferredEndTime || undefined,
      note: dto.note || undefined,
      status: WATER_REQUEST_STATUS.PENDING,
    });

    const tubewell = await this.tubewellsService.findById(dto.tubewellId);
    const farmer = await this.usersService.findById(customerId);

    // Notify Tubewell Owner
    if (tubewell?.ownerId) {
      void this.notificationsService.create({
        userId: String(tubewell.ownerId),
        title: 'New Water Request',
        body: `${farmer?.name || 'A farmer'} requested water for ${field.name} (${dto.requestedDurationMinutes} mins).`,
        type: 'water_request_new',
        data: {
          type: 'water_request_new',
          tubewell_id: dto.tubewellId,
          water_request_id: String(doc._id),
          customer_id: customerId,
        },
      });
    }

    return doc;
  }

  /** Farmer lists their water requests with current queue position */
  async listForCustomer(
    customerId: string,
    tubewellId?: string,
    status?: string,
  ): Promise<any[]> {
    const query: Record<string, unknown> = { customerId: new Types.ObjectId(customerId) };
    if (tubewellId) query.tubewellId = new Types.ObjectId(tubewellId);
    if (status) query.status = status;

    const requests = await this.requestModel.find(query).sort({ createdAt: -1 }).exec();

    const out: any[] = [];
    for (const req of requests) {
      const tubewell = await this.tubewellsService.findById(String(req.tubewellId));
      const field = await this.fieldsService.findByIdForCustomer(customerId, String(req.fieldId));

      let queuePosition: number | null = null;
      let queueStatus: string | null = null;

      if (req.status === WATER_REQUEST_STATUS.ACCEPTED) {
        const qEntry = await this.queueModel
          .findOne({
            waterRequestId: req._id,
            status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.ACTIVE] },
          })
          .exec();
        if (qEntry) {
          queuePosition = qEntry.queuePosition;
          queueStatus = qEntry.status;
        }
      }

      let actualDurationMinutes: number | null = null;
      let finalAmountPaise: number | null = null;

      if (req.status === WATER_REQUEST_STATUS.COMPLETED) {
        const session = await this.sessionModel
          .findOne({
            $or: [
              { waterRequestId: req._id },
              { customerId: req.customerId, tubewellId: req.tubewellId, fieldId: req.fieldId, completedAt: { $exists: true } },
            ],
          })
          .sort({ completedAt: -1, createdAt: -1 })
          .exec();

        if (session && session.durationMinutes != null) {
          actualDurationMinutes = session.durationMinutes;
          finalAmountPaise = session.finalAmountPaise ?? null;
        }
      }

      out.push({
        id: String(req._id),
        tubewellId: String(req.tubewellId),
        tubewellName: tubewell?.name || null,
        customerId: String(req.customerId),
        fieldId: String(req.fieldId),
        fieldName: field?.name || null,
        cropId: req.cropId ? String(req.cropId) : null,
        cropName: req.cropName || null,
        requestedDurationMinutes: req.requestedDurationMinutes,
        actualDurationMinutes,
        finalAmountPaise,
        requestedDate: req.requestedDate || null,
        preferredStartTime: req.preferredStartTime || null,
        preferredEndTime: req.preferredEndTime || null,
        note: req.note || null,
        status: req.status,
        rejectionReason: req.rejectionReason || null,
        queuePosition,
        queueStatus,
        acceptedAt: req.acceptedAt || null,
        rejectedAt: req.rejectedAt || null,
        cancelledAt: req.cancelledAt || null,
        completedAt: req.completedAt || null,
        createdAt: (req as any).createdAt,
      });
    }

    return out;
  }

  /** Farmer cancels a pending or accepted request */
  async cancelRequest(customerId: string, requestId: string): Promise<WaterRequestDocument> {
    const req = await this.requestModel.findById(requestId).exec();
    if (!req) throw new NotFoundException('Water request not found');
    if (String(req.customerId) !== customerId) {
      throw new ForbiddenException('You are not authorized to cancel this request');
    }

    if (
      req.status !== WATER_REQUEST_STATUS.PENDING &&
      req.status !== WATER_REQUEST_STATUS.ACCEPTED
    ) {
      throw new BadRequestException(`Cannot cancel a request with status "${req.status}"`);
    }

    req.status = WATER_REQUEST_STATUS.CANCELLED;
    req.cancelledAt = new Date();
    await req.save();

    // Remove from queue if it was queued
    const qEntry = await this.queueModel
      .findOne({
        waterRequestId: req._id,
        status: QUEUE_STATUS.WAITING,
      })
      .exec();

    if (qEntry) {
      qEntry.status = QUEUE_STATUS.CANCELLED;
      await qEntry.save();
      await this.waterQueueService.normalizeQueuePositions(String(req.tubewellId));
    }

    return req;
  }

  /** Owner lists requests for their tubewell with pending balance for each farmer */
  async listForOwner(
    ownerId: string,
    tubewellId: string,
    status?: string,
  ): Promise<any[]> {
    await this.tubewellsService.ownerMustOwn(tubewellId, ownerId);

    const query: Record<string, unknown> = { tubewellId: new Types.ObjectId(tubewellId) };
    if (status) query.status = status;

    const requests = await this.requestModel.find(query).sort({ createdAt: -1 }).exec();
    const tubewell = await this.tubewellsService.findById(tubewellId);

    const out: any[] = [];
    for (const req of requests) {
      const farmer = await this.usersService.findById(String(req.customerId));
      const field = req.fieldId
        ? await this.fieldsService.findByIdForCustomer(String(req.customerId), String(req.fieldId))
        : null;

      // Calculate current outstanding amount for this customer at this tubewell
      const unpaidSessions = await this.sessionModel
        .find({
          tubewellId: new Types.ObjectId(tubewellId),
          customerId: req.customerId,
          paymentStatus: { $in: [PAYMENT_STATUS.UNPAID, PAYMENT_STATUS.PARTIALLY_PAID] },
        })
        .exec();

      let pendingBalancePaise = 0;
      for (const s of unpaidSessions) {
        pendingBalancePaise += (s.finalAmountPaise || 0) - (s.paidAmountPaise || 0);
      }

      let queuePosition: number | null = null;
      let queueStatus: string | null = null;
      if (req.status === WATER_REQUEST_STATUS.ACCEPTED) {
        const qEntry = await this.queueModel
          .findOne({
            waterRequestId: req._id,
            status: { $in: [QUEUE_STATUS.WAITING, QUEUE_STATUS.ACTIVE] },
          })
          .exec();
        if (qEntry) {
          queuePosition = qEntry.queuePosition;
          queueStatus = qEntry.status;
        }
      }

      out.push({
        id: String(req._id),
        tubewellId: String(req.tubewellId),
        tubewellName: tubewell?.name || null,
        customerId: String(req.customerId),
        customerName: farmer?.name || null,
        customerPhone: farmer?.phone || null,
        fieldId: String(req.fieldId),
        fieldName: field?.name || null,
        cropId: req.cropId ? String(req.cropId) : null,
        cropName: req.cropName || null,
        requestedDurationMinutes: req.requestedDurationMinutes,
        requestedDate: req.requestedDate || null,
        preferredStartTime: req.preferredStartTime || null,
        preferredEndTime: req.preferredEndTime || null,
        note: req.note || null,
        status: req.status,
        rejectionReason: req.rejectionReason || null,
        pendingBalancePaise,
        pendingBalanceRupees: this.money.paiseToRupees(pendingBalancePaise),
        queuePosition,
        queueStatus,
        acceptedAt: req.acceptedAt || null,
        rejectedAt: req.rejectedAt || null,
        cancelledAt: req.cancelledAt || null,
        completedAt: req.completedAt || null,
        createdAt: (req as any).createdAt,
      });
    }

    return out;
  }

  /** Owner accepts a water request */
  async acceptRequest(ownerId: string, requestId: string): Promise<any> {
    const req = await this.requestModel.findById(requestId).exec();
    if (!req) throw new NotFoundException('Water request not found');
    await this.tubewellsService.ownerMustOwn(String(req.tubewellId), ownerId);

    if (req.status !== WATER_REQUEST_STATUS.PENDING) {
      throw new BadRequestException(`Request is already ${req.status}`);
    }

    req.status = WATER_REQUEST_STATUS.ACCEPTED;
    req.acceptedAt = new Date();
    await req.save();

    // Create Queue Entry
    const qEntry = await this.waterQueueService.addToQueue({
      tubewellId: String(req.tubewellId),
      waterRequestId: String(req._id),
      customerId: String(req.customerId),
      fieldId: String(req.fieldId),
      cropId: req.cropId ? String(req.cropId) : undefined,
      cropName: req.cropName || undefined,
    });

    return {
      request: req,
      queueEntry: qEntry,
      queuePosition: qEntry.queuePosition,
    };
  }

  /** Owner rejects a water request */
  async rejectRequest(
    ownerId: string,
    requestId: string,
    dto: RejectWaterRequestDto,
  ): Promise<WaterRequestDocument> {
    const req = await this.requestModel.findById(requestId).exec();
    if (!req) throw new NotFoundException('Water request not found');
    await this.tubewellsService.ownerMustOwn(String(req.tubewellId), ownerId);

    if (req.status !== WATER_REQUEST_STATUS.PENDING) {
      throw new BadRequestException(`Request is already ${req.status}`);
    }

    req.status = WATER_REQUEST_STATUS.REJECTED;
    req.rejectedAt = new Date();
    req.rejectionReason = dto.rejectionReason?.trim() || undefined;
    await req.save();

    const field = await this.fieldsService.findByIdForCustomer(
      String(req.customerId),
      String(req.fieldId),
    );

    // Notify farmer about rejection
    void this.notificationsService.create({
      userId: String(req.customerId),
      title: 'Water Request Rejected',
      body: `Your water request for ${field?.name || 'field'} has been rejected.${dto.rejectionReason ? ` Reason: ${dto.rejectionReason}` : ''}`,
      type: 'water_request_rejected',
      data: {
        type: 'water_request_rejected',
        tubewell_id: String(req.tubewellId),
        water_request_id: String(req._id),
        rejection_reason: dto.rejectionReason || '',
      },
    });

    return req;
  }
}

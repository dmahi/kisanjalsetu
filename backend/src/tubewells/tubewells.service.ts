import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import {
  Tubewell,
  TubewellDocument,
  TubewellSettings,
} from './schemas/tubewell.schema';
import {
  TubewellCustomer,
  TubewellCustomerDocument,
} from './schemas/tubewell-customer.schema';
import {
  MEMBERSHIP_STATUS,
  ROLES,
  TUBEWELL_STATUS,
  Role,
} from '../common/constants';
import { UsersService } from '../users/users.service';
import { BecomeOwnerDto } from './dto/tubewell.dto';

@Injectable()
export class TubewellsService {
  constructor(
    @InjectModel(Tubewell.name) private readonly tubewellModel: Model<TubewellDocument>,
    @InjectModel(TubewellCustomer.name)
    private readonly membershipModel: Model<TubewellCustomerDocument>,
    private readonly usersService: UsersService,
  ) {}

  private withLocation<T extends { latitude?: number; longitude?: number }>(data: T): T {
    if (data.latitude != null && data.longitude != null) {
      return Object.assign(data, {
        location: { type: 'Point', coordinates: [data.longitude, data.latitude] },
      }) as T;
    }
    if (data.latitude == null && data.longitude == null) {
      return Object.assign(data, { location: undefined }) as T;
    }
    return data;
  }

  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `TW-${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.tubewellModel.exists({ code }).exec();
      if (!exists) return code;
    }
    throw new BadRequestException('Could not generate a unique tubewell code');
  }

  async create(
    ownerId: string,
    data: Omit<Partial<Tubewell>, 'settings'> & { settings?: Partial<TubewellSettings> },
  ): Promise<TubewellDocument> {
    const code = String(data.code ?? '').trim().toUpperCase();
    if (!code) throw new BadRequestException('Tubewell code is required');
    const exists = await this.tubewellModel.findOne({ code }).exec();
    if (exists) throw new BadRequestException('That tubewell code is already taken');
    const withLocation = this.withLocation({ ...data });
    delete withLocation.latitude;
    delete withLocation.longitude;
    return this.tubewellModel.create({
      ...withLocation,
      code,
      ownerId: new Types.ObjectId(ownerId),
    });
  }

  /** One-way farmer -> tubewell owner upgrade. Creates their first tubewell. */
  async becomeOwner(userId: string, dto: BecomeOwnerDto): Promise<{ user: any; tubewell: TubewellDocument }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== ROLES.FARMER) {
      throw new BadRequestException('Only farmers can upgrade to become tubewell owners');
    }
    const code = await this.generateUniqueCode();
    let tubewell: TubewellDocument | null = null;
    try {
      const { latitude, longitude, ...rest } = dto;
      const withLocation = this.withLocation({ ...rest, latitude, longitude });
      delete withLocation.latitude;
      delete withLocation.longitude;
      tubewell = await this.tubewellModel.create({
        ...withLocation,
        code,
        ownerId: new Types.ObjectId(userId),
        settings: { ratePerHourPaise: dto.ratePerHourPaise },
        images: dto.images ?? [],
        status: TUBEWELL_STATUS.ACTIVE,
      });
      await this.usersService.setRole(userId, ROLES.TUBEWELL_OWNER);
      if (dto.profileImage) {
        await this.usersService.updateProfile(userId, { profileImage: dto.profileImage });
      }
      const updated = await this.usersService.findById(userId);
      return { user: updated, tubewell };
    } catch (err) {
      if (tubewell) {
        await this.tubewellModel.deleteOne({ _id: tubewell._id }).exec();
      }
      throw err;
    }
  }

  async findById(id: string): Promise<TubewellDocument | null> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) return null;
    return this.tubewellModel.findById(id).exec();
  }

  async findByIdOrThrow(id: string): Promise<TubewellDocument> {
    const doc = await this.findById(id);
    if (!doc) throw new NotFoundException('Tubewell not found');
    return doc;
  }

  async ownerMustOwn(tubewellId: string, ownerId: string): Promise<TubewellDocument> {
    const tubewell = await this.findByIdOrThrow(tubewellId);
    if (String(tubewell.ownerId) !== ownerId) {
      throw new ForbiddenException('You do not own this tubewell');
    }
    return tubewell;
  }

  async listForOwner(ownerId: string): Promise<TubewellDocument[]> {
    return this.tubewellModel
      .find({ ownerId: new Types.ObjectId(ownerId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async update(
    tubewellId: string,
    ownerId: string,
    patch: Partial<Tubewell> | { settings?: Partial<TubewellSettings> },
  ): Promise<TubewellDocument> {
    const tubewell = await this.ownerMustOwn(tubewellId, ownerId);
    if (patch['settings']) {
      tubewell.settings = Object.assign(tubewell.settings, patch['settings']);
      delete patch['settings'];
    }
    const withLocation = this.withLocation({ ...patch } as Partial<Tubewell>);
    delete withLocation.latitude;
    delete withLocation.longitude;
    Object.assign(tubewell, withLocation);
    await tubewell.save();
    return tubewell;
  }

  async remove(tubewellId: string, ownerId: string): Promise<void> {
    await this.ownerMustOwn(tubewellId, ownerId);
    await this.membershipModel
      .deleteMany({ tubewellId: new Types.ObjectId(tubewellId) })
      .exec();
    await this.tubewellModel.deleteOne({ _id: new Types.ObjectId(tubewellId) }).exec();
  }

  async setStatus(tubewellId: string, status: string): Promise<TubewellDocument> {
    const doc = await this.tubewellModel
      .findByIdAndUpdate(tubewellId, { status }, { new: true })
      .exec();
    if (!doc) throw new NotFoundException('Tubewell not found');
    return doc;
  }

  async search(query: { search?: string; latitude?: number; longitude?: number; maxDistanceKm?: number }): Promise<TubewellDocument[]> {
    const filter: Record<string, unknown> = { status: TUBEWELL_STATUS.ACTIVE };
    if (query.search) {
      const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter['$or'] = [{ name: re }, { code: re }, { village: re }, { address: re }];
    }
    if (query.latitude != null && query.longitude != null) {
      filter.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [query.longitude, query.latitude] },
          $maxDistance: (query.maxDistanceKm || 25) * 1000,
        },
      };
    }
    return this.tubewellModel.find(filter).sort({ name: 1 }).limit(100).exec();
  }

  async requestMembership(tubewellId: string, customerId: string): Promise<TubewellCustomerDocument> {
    const tubewell = await this.findByIdOrThrow(tubewellId);
    if (!tubewell.settings?.allowCustomerRequest) {
      throw new BadRequestException('This tubewell is not accepting customer requests');
    }
    if (tubewell.status !== TUBEWELL_STATUS.ACTIVE) {
      throw new BadRequestException('This tubewell is not active');
    }
    const existing = await this.membershipModel
      .findOne({
        tubewellId: new Types.ObjectId(tubewellId),
        customerId: new Types.ObjectId(customerId),
      })
      .exec();
    if (existing) {
      if (existing.status === MEMBERSHIP_STATUS.PENDING) {
        throw new BadRequestException('Your request is already pending approval');
      }
      if (existing.status === MEMBERSHIP_STATUS.APPROVED) {
        throw new BadRequestException('You are already registered with this tubewell');
      }
      if (existing.status === MEMBERSHIP_STATUS.REJECTED) {
        existing.status = MEMBERSHIP_STATUS.PENDING;
        existing.requestedAt = new Date();
        existing.approvedAt = undefined;
        existing.rejectedAt = undefined;
        await existing.save();
        return existing;
      }
      throw new BadRequestException('Your membership is suspended');
    }
    return this.membershipModel.create({
      tubewellId: new Types.ObjectId(tubewellId),
      customerId: new Types.ObjectId(customerId),
      status: MEMBERSHIP_STATUS.PENDING,
      requestedAt: new Date(),
    });
  }

  async listMembershipsForCustomer(customerId: string): Promise<TubewellCustomerDocument[]> {
    return this.membershipModel
      .find({ customerId: new Types.ObjectId(customerId) })
      .sort({ updatedAt: -1 })
      .exec();
  }

  async verifyApprovedMembership(tubewellId: string, customerId: string): Promise<TubewellCustomerDocument> {
    const m = await this.membershipModel
      .findOne({
        tubewellId: new Types.ObjectId(tubewellId),
        customerId: new Types.ObjectId(customerId),
      })
      .exec();
    if (!m || m.status !== MEMBERSHIP_STATUS.APPROVED) {
      throw new ForbiddenException('You are not a registered customer of this tubewell');
    }
    return m;
  }

  async listCustomersForOwner(tubewellId: string, search?: string): Promise<Array<{ membership: TubewellCustomerDocument; user: any }>> {
    const filter: Record<string, unknown> = { tubewellId: new Types.ObjectId(tubewellId) };
    const memberships = await this.membershipModel.find(filter).sort({ updatedAt: -1 }).exec();
    const results: Array<{ membership: TubewellCustomerDocument; user: any }> = [];
    for (const m of memberships) {
      const user = await this.usersService.findById(String(m.customerId));
      if (!user) continue;
      const nameMatch = !search || user.name.toLowerCase().includes(search.toLowerCase());
      const phoneMatch = !search || user.phone.includes(search);
      if (nameMatch || phoneMatch) {
        results.push({
          membership: m,
          user: {
            id: String(user._id),
            name: user.name,
            phone: user.phone,
          },
        });
      }
    }
    return results;
  }

  async membershipAction(
    tubewellId: string,
    customerId: string,
    action: 'approve' | 'reject',
    approvedBy: string,
  ): Promise<TubewellCustomerDocument> {
    const m = await this.membershipModel
      .findOne({
        tubewellId: new Types.ObjectId(tubewellId),
        customerId: new Types.ObjectId(customerId),
      })
      .exec();
    if (!m) throw new NotFoundException('Registration request not found');
    if (action === 'approve') {
      m.status = MEMBERSHIP_STATUS.APPROVED;
      m.approvedAt = new Date();
      m.approvedBy = new Types.ObjectId(approvedBy);
      m.rejectedAt = undefined;
    } else {
      m.status = MEMBERSHIP_STATUS.REJECTED;
      m.rejectedAt = new Date();
      m.approvedBy = new Types.ObjectId(approvedBy);
    }
    await m.save();
    return m;
  }

  async isCustomerApproved(tubewellId: string, customerId: string): Promise<boolean> {
    const m = await this.membershipModel
      .findOne({
        tubewellId: new Types.ObjectId(tubewellId),
        customerId: new Types.ObjectId(customerId),
      })
      .exec();
    return Boolean(m && m.status === MEMBERSHIP_STATUS.APPROVED);
  }

  async countApprovedMemberships(tubewellId: string): Promise<number> {
    return this.membershipModel
      .countDocuments({
        tubewellId: new Types.ObjectId(tubewellId),
        status: MEMBERSHIP_STATUS.APPROVED,
      })
      .exec();
  }
}
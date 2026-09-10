import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Role, USER_STATUS } from '../common/constants';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) return null;
    return this.userModel.findById(id).exec();
  }

  async findByIdOrThrow(id: string): Promise<UserDocument> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: {
    name: string;
    phone: string;
    role: Role;
    email?: string;
  }): Promise<UserDocument> {
    return this.userModel.create({
      ...data,
      status: USER_STATUS.ACTIVE,
      phoneVerifiedAt: new Date(),
    });
  }

  async updateProfile(id: string, patch: Partial<User>): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setStatus(id: string, status: string): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setRole(id: string, role: Role): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, { role }, { new: true }).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async countByRole(role?: Role): Promise<number> {
    const query = role ? { role } : {};
    return this.userModel.countDocuments(query as any).exec();
  }
}
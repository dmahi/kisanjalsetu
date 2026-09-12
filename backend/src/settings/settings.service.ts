import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { AppSetting, AppSettingDocument } from './schemas/app-setting.schema';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(AppSetting.name) private readonly settingModel: Model<AppSettingDocument>,
    private readonly config: ConfigService,
  ) {}

  async getSettings(): Promise<AppSettingDocument> {
    let settings = await this.settingModel.findOne().exec();
    if (!settings) {
      const defaultAppName = this.config.get<string>('APP_NAME', 'KisanJalSetu');
      const defaultServiceAccount = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT', '');
      const defaultServerKey = this.config.get<string>('FIREBASE_SERVER_KEY', '');

      settings = await this.settingModel.create({
        appName: defaultAppName,
        firebaseServiceAccount: defaultServiceAccount || undefined,
        firebaseServerKey: defaultServerKey || undefined,
      });
    }
    return settings;
  }

  async updateSettings(dto: UpdateSettingsDto, userId?: string): Promise<AppSettingDocument> {
    let settings = await this.settingModel.findOne().exec();
    const updateData: Partial<AppSetting> = {
      ...(dto.appName ? { appName: dto.appName.trim() } : {}),
      ...(dto.firebaseServiceAccount !== undefined ? { firebaseServiceAccount: dto.firebaseServiceAccount.trim() } : {}),
      ...(dto.firebaseServerKey !== undefined ? { firebaseServerKey: dto.firebaseServerKey.trim() } : {}),
      ...(userId && Types.ObjectId.isValid(userId) ? { updatedBy: new Types.ObjectId(userId) } : {}),
    };

    if (!settings) {
      settings = await this.settingModel.create({
        appName: 'KisanJalSetu',
        ...updateData,
      });
    } else {
      settings = (await this.settingModel
        .findByIdAndUpdate(settings._id, updateData, { new: true })
        .exec())!;
    }
    return settings;
  }

  async getPublicSettings(): Promise<{ appName: string }> {
    const settings = await this.getSettings();
    return {
      appName: settings.appName || 'KisanJalSetu',
    };
  }
}

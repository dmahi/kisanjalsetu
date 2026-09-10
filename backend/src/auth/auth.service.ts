import { BadRequestException, ConflictException, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { Otp, OtpDocument } from './schemas/otp.schema';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { UsersService } from '../users/users.service';
import { WhatsendProvider, OTP_PROVIDER } from './whatsapp/whatsapp.provider';
import { ROLES } from '../common/constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(Otp.name) private readonly otpModel: Model<OtpDocument>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject(OTP_PROVIDER) private readonly otpProvider: WhatsendProvider,
  ) {}

  async sendOtp(dto: SendOtpDto): Promise<{ message: string; resent: boolean }> {
    const phone = this.normalizePhone(dto.phone);
    const ttlMs = this.config.get<number>('OTP_TTL_MINUTES', 10) * 60 * 1000;
    const resendSeconds = this.config.get<number>('OTP_RESEND_SECONDS', 60);

    const recent = await this.otpModel
      .findOne({ phone, used: false })
      .sort({ createdAt: -1 })
      .exec();
    if (recent && Date.now() - (recent as any).createdAt.getTime() < resendSeconds * 1000) {
      const wait = Math.ceil((resendSeconds - (Date.now() - (recent as any).createdAt.getTime()) / 1000));
      throw new BadRequestException(`Please wait ${wait}s before requesting another OTP`);
    }

    const code = this.generateCode();
    await this.otpModel.create({ phone, code, expiresAt: new Date(Date.now() + ttlMs) });

    const existing = await this.usersService.findByPhone(phone);
    try {
      await this.otpProvider.sendOtp({
        phone,
        code,
        name: existing?.name || undefined,
      });
    } catch (err) {
      this.logger.error(`OTP delivery failed: ${(err as Error).message}`);
      throw new BadRequestException('Unable to send OTP right now. Try again shortly.');
    }

    return { message: 'OTP sent successfully', resent: Boolean(recent) };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ token: string; user: unknown }> {
    const phone = this.normalizePhone(dto.phone);
    const maxAttempts = this.config.get<number>('OTP_MAX_ATTEMPTS', 5);
    const devCode = this.config.get<string>('DEV_OTP_CODE', '123456');
    const isDev = this.config.get<string>('OTP_PROVIDER', 'log') === 'log';

    const otp = await this.otpModel.findOne({ phone, used: false }).sort({ createdAt: -1 }).exec();
    if (!otp) throw new UnauthorizedException('No active OTP for this phone. Request a new one.');

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('OTP has expired. Request a new one.');
    }

    const valid = isDev && dto.code === devCode ? true : otp.code === dto.code;
    if (!valid) {
      otp.attempts += 1;
      if (otp.attempts >= maxAttempts) otp.used = true;
      await otp.save();
      throw new UnauthorizedException('Invalid OTP code');
    }

    let user = await this.usersService.findByPhone(phone);
    if (!user) {
      if (!dto.name) {
        throw new BadRequestException('Name is required for first-time registration');
      }
      user = await this.usersService.create({ phone, name: dto.name, role: ROLES.FARMER });
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Your account has been suspended.');
    }

    otp.used = true;
    otp.attempts += 1;
    await otp.save();

    const token = await this.jwtService.signAsync({
      sub: String(user._id),
      phone: user.phone,
      role: user.role,
    });

    return {
      token,
      user: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    };
  }

  private normalizePhone(phone: string): string {
    let p = phone.trim().replace(/[^0-9+]/g, '');
    if (p.startsWith('+91') && p.length === 13) return p;
    if (p.startsWith('91') && p.length === 12) return `+${p}`;
    if (p.startsWith('0') && p.length === 11) return `+91${p.slice(1)}`;
    if (p.length === 10) return `+91${p}`;
    return p;
  }

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}
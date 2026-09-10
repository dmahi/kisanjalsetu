import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Otp, OtpSchema } from './schemas/otp.schema';
import { UsersModule } from '../users/users.module';
import { LogWhatsAppProvider } from './whatsapp/log.whatsapp.provider';
import { MetaWhatsAppProvider } from './whatsapp/meta.whatsapp.provider';
import { CompositeOtpProvider } from './whatsapp/composite.provider';
import { SmsProvider } from './sms/sms.provider';
import { OTP_PROVIDER, WhatsendProvider } from './whatsapp/whatsapp.provider';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Otp.name, schema: OtpSchema }]),
    UsersModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '30d') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: OTP_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): WhatsendProvider => {
        const mode = config.get<string>('OTP_PROVIDER', 'log').toLowerCase();
        const channels = mode.split(',').map((c) => c.trim()).filter(Boolean);
        const providers: WhatsendProvider[] = [];
        if (channels.includes('log')) return new LogWhatsAppProvider(config);
        if (channels.includes('whatsapp')) providers.push(new MetaWhatsAppProvider(config));
        if (channels.includes('sms')) providers.push(new SmsProvider(config));
        if (providers.length > 1) return new CompositeOtpProvider(providers);
        if (providers.length === 1) return providers[0];
        return new LogWhatsAppProvider(config);
      },
    },
  ],
  exports: [JwtModule, OTP_PROVIDER],
})
export class AuthModule {}
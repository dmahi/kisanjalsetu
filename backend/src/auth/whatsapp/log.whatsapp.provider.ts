import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendOtpOptions, WhatsendProvider } from './whatsapp.provider';

/**
 * Development provider. Never sends an external message — writes the OTP to the
 * server console so the whole flow can be exercised without any SMS/WhatsApp keys.
 */
export class LogWhatsAppProvider implements WhatsendProvider {
  readonly name = 'log';
  private readonly logger = new Logger('WhatsAppProvider[log]');

  constructor(private readonly config: ConfigService) {}

  async sendOtp(options: SendOtpOptions): Promise<void> {
    this.logger.warn(
      `[DEV OTP] Phone: ${options.phone} | Code: ${options.code} | Expires: ${this.config.get('OTP_TTL_MINUTES', 10)} min`,
    );
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    this.logger.warn(`[DEV MSG] ${phone}: ${message}`);
  }
}
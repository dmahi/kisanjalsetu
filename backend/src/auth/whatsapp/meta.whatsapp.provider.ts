import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendOtpOptions, WhatsendProvider } from './whatsapp.provider';

const META_API = 'https://graph.facebook.com/v19.0';

/**
 * Meta WhatsApp Cloud API provider. Requires:
 *  - WHATSAPP_TOKEN    (system user access token)
 *  - WHATSAPP_PHONE_ID (business phone number id)
 *  - WHATSAPP_FROM     (the same number as international format, e.g. 919876543210)
 */
@Injectable()
export class MetaWhatsAppProvider implements WhatsendProvider {
  readonly name = 'whatsapp';
  private readonly logger = new Logger('WhatsAppProvider[meta]');

  constructor(private readonly config: ConfigService) {}

  private get token(): string {
    return this.config.get<string>('WHATSAPP_TOKEN', '');
  }

  private get phoneId(): string {
    return this.config.get<string>('WHATSAPP_PHONE_ID', '');
  }

  private get from(): string {
    return this.config.get<string>('WHATSAPP_FROM', '');
  }

  private get ready(): boolean {
    return Boolean(this.token && this.phoneId && this.from);
  }

  private async postText(to: string, body: string): Promise<void> {
    if (!this.ready) {
      this.logger.warn('WhatsApp provider not configured; skipping send');
      return;
    }
    const res = await fetch(`${META_API}/${this.phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`WhatsApp send failed (${res.status}): ${text}`);
    }
  }

  async sendOtp(options: SendOtpOptions): Promise<void> {
    const name = options.name ? ` ${options.name}` : '';
    await this.postText(
      options.phone,
      `Hello${name}! Your WaterApp verification code is ${options.code}. It is valid for ${this.config.get('OTP_TTL_MINUTES', 10)} minutes.`,
    );
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    await this.postText(phone, message);
  }
}
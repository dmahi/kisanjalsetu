import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendOtpOptions, WhatsendProvider } from '../whatsapp/whatsapp.provider';

/**
 * SMS OTP delivery. Supports an internal gateway (MSG91 / Twilio) selectable via
 * the `SMS_PROVIDER` env var. Using the `WhatsendProvider` contract keeps the
 * auth service channel-agnostic so phone + OTP works over WhatsApp, SMS or both.
 */
@Injectable()
export class SmsProvider implements WhatsendProvider {
  readonly name = 'sms';
  private readonly logger = new Logger('SmsProvider[sms]');

  constructor(private readonly config: ConfigService) {}

  private get provider(): string {
    return this.config.get<string>('SMS_PROVIDER', 'msg91');
  }

  private get apiKey(): string {
    return this.config.get<string>('SMS_API_KEY', '');
  }

  private get senderId(): string {
    return this.config.get<string>('SMS_SENDER_ID', '');
  }

  private get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async sendOtp(options: SendOtpOptions): Promise<void> {
    const name = options.name ? ` ${options.name}` : '';
    const message =
      `Hello${name}! Your WaterApp verification code is ${options.code}. ` +
      `It is valid for ${this.config.get('OTP_TTL_MINUTES', 10)} minutes.`;
    await this.send(options.phone, message);
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    await this.send(phone, message);
  }

  private async send(phone: string, message: string): Promise<void> {
    if (!this.configured) {
      this.logger.warn('SMS provider not configured (SMS_API_KEY missing); skipping send');
      return;
    }
    if (this.provider === 'twilio') {
      await this.sendTwilio(phone, message);
      return;
    }
    await this.sendMsg91(phone, message);
  }

  /** MSG91 (India) — https://control.msg91.com/api/sendhttp.php */
  private async sendMsg91(phone: string, message: string): Promise<void> {
    const params = new URLSearchParams({
      authkey: this.apiKey,
      mobiles: phone.replace(/^\+/, ''),
      message,
      sender: this.senderId || 'WATERAPP',
      route: '4',
    });
    const res = await fetch(`https://control.msg91.com/api/sendhttp.php?${params.toString()}`);
    const text = await res.text();
    if (!res.ok || /error/i.test(text)) {
      throw new Error(`SMS (MSG91) send failed (${res.status}): ${text}`);
    }
  }

  /** Twilio — https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json */
  private async sendTwilio(phone: string, message: string): Promise<void> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID', '');
    const from = this.config.get<string>('TWILIO_FROM', '');
    if (!sid || !from) {
      this.logger.warn('Twilio env TWILIO_ACCOUNT_SID / TWILIO_FROM missing; skipping send');
      return;
    }
    const body = new URLSearchParams({ To: phone, From: from, Body: message });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${this.apiKey}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SMS (Twilio) send failed (${res.status}): ${text}`);
    }
  }
}
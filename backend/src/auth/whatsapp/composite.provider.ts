import { Logger } from '@nestjs/common';
import { SendOtpOptions, WhatsendProvider } from './whatsapp.provider';

/**
 * Delivers OTP through every enabled channel (whatsapp + sms).
 * A channel that is configured but unauthenticated logs a warning and skips;
 * only when *every* channel fails does the composite throw, so a single usable
 * channel keeps the flow working.
 */
export class CompositeOtpProvider implements WhatsendProvider {
  readonly name = 'all';
  private readonly logger = new Logger('OtpProvider[composite]');

  constructor(private readonly channels: WhatsendProvider[]) {}

  async sendOtp(options: SendOtpOptions): Promise<void> {
    let failures = 0;
    for (const channel of this.channels) {
      try {
        await channel.sendOtp(options);
      } catch (err) {
        failures += 1;
        this.logger.error(`Channel "${channel.name}" failed: ${(err as Error).message}`);
      }
    }
    if (failures === this.channels.length && this.channels.length > 0) {
      throw new Error('All OTP delivery channels failed');
    }
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    for (const channel of this.channels) {
      try {
        await channel.sendMessage(phone, message);
      } catch (err) {
        this.logger.error(`Channel "${channel.name}" failed: ${(err as Error).message}`);
      }
    }
  }
}
export interface SendOtpOptions {
  phone: string;
  code: string;
  /** Name of the recipient if already known (used for a friendly message) */
  name?: string;
}

export interface WhatsendProvider {
  readonly name: string;
  sendOtp(options: SendOtpOptions): Promise<void>;
  sendMessage(phone: string, message: string): Promise<void>;
}

export const OTP_PROVIDER = 'OTP_PROVIDER';
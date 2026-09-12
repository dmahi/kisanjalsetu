import { useState } from 'react';
import { authApi } from '../lib/api';

interface Props {
  ready: boolean;
  onLogin: (phone: string, code: string) => Promise<void>;
  onError: (e: unknown) => void;
}

export default function Login({ ready, onLogin, onError }: Props) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [waiting, setWaiting] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9]/g, '');
    if (raw.startsWith('91') && raw.length > 10) {
      raw = raw.slice(2);
    } else if (raw.startsWith('0') && raw.length === 11) {
      raw = raw.slice(1);
    }
    setPhone(raw.slice(0, 10));
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(raw);
  };

  const getFullPhone = () => `+91${phone.replace(/[^0-9]/g, '')}`;

  const startTimer = () => {
    let left = 30;
    setWaiting(left);
    const iv = setInterval(() => {
      left -= 1;
      setWaiting(left);
      if (left <= 0) clearInterval(iv);
    }, 1000);
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length !== 10) {
      onError(new Error('Please enter a valid 10-digit mobile number'));
      return;
    }
    setSending(true);
    const fullPhone = getFullPhone();
    try {
      await onSendOtp(fullPhone);
      setStep('otp');
      startTimer();
    } catch (err) {
      onError(err);
    } finally {
      setSending(false);
    }
  };

  const handleResendOtp = async () => {
    if (waiting > 0 || resending) return;
    setResending(true);
    try {
      await onSendOtp(getFullPhone());
      startTimer();
    } catch (err) {
      onError(err);
    } finally {
      setResending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.replace(/[^0-9]/g, '');
    if (cleanCode.length !== 6) {
      onError(new Error('Please enter a valid 6-digit OTP'));
      return;
    }
    setBusy(true);
    try {
      await onLogin(getFullPhone(), cleanCode);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>WaterApp Admin</h1>
        <p className="muted">Platform administration for tubewell water &amp; billing.</p>
        {!ready ? <div className="spinner" /> : null}
        {ready && step === 'phone' && (
          <form onSubmit={sendOtp}>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 700 }}>
              Admin phone number
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '9px 12px',
                  background: 'var(--bg)',
                  border: '1.5px solid var(--line)',
                  borderRadius: '8px',
                  fontWeight: 700,
                  color: 'var(--ink-soft)',
                  userSelect: 'none',
                }}
              >
                +91
              </span>
              <input
                style={{ flex: 1, margin: 0 }}
                type="tel"
                inputMode="numeric"
                placeholder="9999999999"
                value={phone}
                maxLength={10}
                onChange={handlePhoneChange}
                autoFocus
              />
            </div>
            <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={sending || phone.length !== 10}>
              {sending ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        )}
        {ready && step === 'otp' && (
          <form onSubmit={submit}>
            <p className="muted">
              OTP sent to {getFullPhone()}.{' '}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setStep('phone');
                }}
              >
                change
              </a>
            </p>
            <input
              style={{ width: '100%' }}
              type="tel"
              inputMode="numeric"
              placeholder="6-digit OTP code"
              value={code}
              maxLength={6}
              onChange={handleCodeChange}
              autoFocus
            />
            <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={busy || code.length !== 6}>
              {busy ? 'Verifying…' : 'Verify & Login'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              {waiting > 0 ? (
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  Resend OTP in {waiting}s
                </span>
              ) : (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    void handleResendOtp();
                  }}
                  style={{ fontSize: '0.85rem', fontWeight: 600 }}
                >
                  {resending ? 'Resending OTP…' : 'Resend OTP'}
                </a>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

async function onSendOtp(phone: string): Promise<void> {
  await authApi.sendOtp(phone);
}
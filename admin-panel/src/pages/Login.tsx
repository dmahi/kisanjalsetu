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
  const [waiting, setWaiting] = useState<number>(0);
  const [busy, setBusy] = useState(false);

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\+?[0-9]{10,15}$/.test(phone.trim())) {
      onError(new Error('Enter a valid phone number (e.g. +919999999999)'));
      return;
    }
    setSending(true);
    try {
      await onSendOtp(phone.trim());
      setStep('otp');
      let left = 30;
      setWaiting(left);
      const iv = setInterval(() => {
        left -= 1;
        setWaiting(left);
        if (left <= 0) clearInterval(iv);
      }, 1000);
      return () => clearInterval(iv);
    } catch (err) {
      onError(err);
    } finally {
      setSending(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{4,8}$/.test(code.trim())) {
      onError(new Error('Enter the 4-8 digit OTP'));
      return;
    }
    setBusy(true);
    try {
      await onLogin(phone.trim(), code.trim());
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
            <input
              style={{ width: '100%' }}
              type="tel"
              placeholder="+919999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={sending}>
              {sending ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        )}
        {ready && step === 'otp' && (
          <form onSubmit={submit}>
            <p className="muted">OTP sent to {phone}. <a href="#" onClick={(e) => { e.preventDefault(); setStep('phone'); }}>change</a></p>
            <input
              style={{ width: '100%' }}
              inputMode="numeric"
              placeholder="OTP code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={busy || waiting > 0}>
              {busy ? 'Verifying…' : waiting > 0 ? `Resend in ${waiting}s` : step === 'otp' ? 'Verify & Login' : 'Send OTP'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

async function onSendOtp(phone: string): Promise<void> {
  await authApi.sendOtp(phone);
}
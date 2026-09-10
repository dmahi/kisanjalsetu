import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../api/client';
import { useToast } from '../../components/ui';
import { useLocale } from '../../store/locale.store';

export default function PhoneLogin() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { show, toast } = useToast();
  const navigate = useNavigate();
  const t = useLocale((s) => s.t);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/[^0-9]/g, '');
    if (clean.length !== 10) {
      show(t('invalid_phone'), 'error');
      return;
    }
    setLoading(true);
    try {
      await authApi.sendOtp(`+91${clean}`);
      navigate('/login/otp', { state: { phone: `+91${clean}` } });
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-auth" style={{ paddingTop: 40 }}>
      {toast}
      <div className="auth-hero">
        <img src="/logo.png" alt={t('app_name')} />
        <h1>{t('app_name')}</h1>
        <p>{t('tagline')}</p>
      </div>

      <form onSubmit={submit} className="card auth-card">
        <label>{t('enter_phone')}</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value="+91" disabled className="phone-prefix" />
          <input
            inputMode="numeric"
            placeholder="98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            autoFocus
          />
        </div>
        <button type="submit" className="btn btn-primary btn-lg mt" disabled={loading}>
          {loading ? t('sending') : t('send_otp')}
        </button>
      </form>
      <p className="muted center" style={{ fontSize: '0.78rem', marginTop: 18 }}>
        {t('otp_delivery_note')}
      </p>
    </div>
  );
}
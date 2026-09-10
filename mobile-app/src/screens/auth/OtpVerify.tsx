import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { apiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/auth.store';
import { useLocale } from '../../store/locale.store';
import { useToast } from '../../components/ui';

export default function OtpVerify() {
  const location = useLocation();
  const navigate = useNavigate();
  const phone = (location.state as { phone?: string } | null)?.phone ?? '+91';
  const login = useAuthStore((s) => s.login);
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 4) {
      show(t('enter_otp_hint'), 'error');
      return;
    }
    if (needName && !name.trim()) {
      show(t('name_required'), 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, code, needName ? name : undefined);
      if (res.user.role === 'admin') {
        show(t('admin_use_panel'), 'info');
        navigate('/login', { replace: true });
        return;
      }
      await login(res.token, res.user);
      navigate('/', { replace: true });
    } catch (err) {
      const msg = apiErrorMessage(err);
      if (/name is required/i.test(msg)) {
        setNeedName(true);
        show(t('new_account_hint'), 'info');
      } else {
        show(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-auth" style={{ paddingTop: 28 }}>
      {toast}
      <div className="auth-hero auth-hero-sm">
        <h1>{t('verify_otp')}</h1>
        <p>{t('otp_sent_to', { phone })}</p>
      </div>

      <form onSubmit={submit} className="card auth-card">
        {needName ? (
          <>
            <label>{t('name')}</label>
            <input placeholder={t('your_name_hint')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </>
        ) : null}

        <label>{t('enter_otp')}</label>
        <input
          inputMode="numeric"
          placeholder="••••••"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          style={{ textAlign: 'center', fontSize: '1.6rem', letterSpacing: 8 }}
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-lg mt" disabled={loading}>
          {loading ? t('verifying') : t('verify_otp')}
        </button>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link to="/login" className="muted" style={{ fontSize: '0.88rem' }}>← {t('cancel')}</Link>
        </div>
      </form>
    </div>
  );
}
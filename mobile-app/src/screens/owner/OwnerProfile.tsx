import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { tubewellApi, type Tubewell } from '../../api/tubewells';
import { useAuthStore } from '../../store/auth.store';
import { useLocale, LOCALES, type Locale } from '../../store/locale.store';
import { PageHeader, Card, useToast, Row, Pill, Segmented } from '../../components/ui';

export default function OwnerProfile() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useLocale((s) => s.t);
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const [tubewells, setTubewells] = useState<Tubewell[]>([]);

  const load = async () => {
    try {
      const list = await tubewellApi.mine();
      setTubewells(list || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void load();
  }, []);



  return (
    <div className="page">
      {toast}
      <PageHeader title={t('profile')} subtitle={user?.name ?? ''} />
      <Card>
        <Row title={user?.name ?? ''} sub={user?.phone} right={<Pill tone="info">{user?.role === 'tubewell_owner' ? t('owner_singular') : user?.role}</Pill>} />
        <Link to="/owner/notifications" style={{ textDecoration: 'none' }}>
          <Row title={t('notifications')} sub="Alerts about sessions and payments" right={<span className="muted">›</span>} />
        </Link>
      </Card>

      <Card title={t('language')}>
        <Segmented
          options={(Object.keys(LOCALES) as Locale[]).map((l) => ({ label: LOCALES[l].label, value: l }))}
          value={locale}
          onChange={(l: Locale) => setLocale(l)}
        />
      </Card>

      <Card>
        <Row
          title={<span>🗺️ {t('my_tubewells_count', { count: tubewells.length })}</span>}
          sub="Manage your tubewells, pricing, and settings"
          onClick={() => navigate('/owner/tubewells')}
          right={<span className="muted">›</span>}
        />
      </Card>

      <button className="btn btn-danger mt" onClick={() => void logout().then(() => navigate('/login', { replace: true }))}>
        {t('logout')}
      </button>
    </div>
  );
}
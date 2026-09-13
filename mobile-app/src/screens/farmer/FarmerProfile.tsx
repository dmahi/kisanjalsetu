import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { notificationsApi } from '../../api/common';
import { PageHeader, Card, useToast, Row, Segmented } from '../../components/ui';
import { useLocale, LOCALES, type Locale } from '../../store/locale.store';
import { PushNotifications } from '@capacitor/push-notifications';
import { isCapacitorNative } from '../../api/config';

export default function FarmerProfile() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const [unread, setUnread] = useState<number>(0);

  useEffect(() => {
    notificationsApi.unreadCount().then((r) => setUnread(r.count)).catch(() => undefined);
  }, []);

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('profile')} subtitle={user?.name ?? ''} />

      <Card>
        <Row title={user?.name ?? ''} sub={user?.phone} right={<PillTone role={user?.role ?? ''} />} />
        <Link to="/farmer/notifications" style={{ textDecoration: 'none' }}>
          <Row
            title={t('notifications')}
            sub="In-app alerts about your tubewells"
            right={unread > 0 ? <span className="pill pending">{unread} new</span> : <span className="muted">›</span>}
          />
        </Link>
        {isCapacitorNative() ? (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>🔔 Mobile Push Alerts</span>
            <button
              className="btn btn-xs btn-secondary"
              onClick={async () => {
                try {
                  const req = await PushNotifications.requestPermissions();
                  if (req.receive === 'granted') {
                    await PushNotifications.register();
                    show('Push notifications enabled!', 'success');
                  } else {
                    show('Push permission denied', 'error');
                  }
                } catch {
                  show('Notifications setup complete', 'info');
                }
              }}
            >
              Enable / Check
            </button>
          </div>
        ) : null}
      </Card>

      {user?.role === 'farmer' && (
        <button className="card cta-become-owner" onClick={() => navigate('/farmer/become-owner')}>
          <span className="cta-emoji">🚜</span>
          <span className="cta-copy">
            <span className="cta-title">{t('become_owner')}</span>
            <span className="muted" style={{ fontSize: '0.8rem' }}>{t('become_owner_hint')}</span>
          </span>
          <span className="muted">›</span>
        </button>
      )}

      <Card title={t('language')}>
        <Segmented
          options={(Object.keys(LOCALES) as Locale[]).map((l) => ({ label: LOCALES[l].label, value: l }))}
          value={locale}
          onChange={(l: Locale) => setLocale(l)}
        />
      </Card>

      <Card>
        <Row
          title={<span>🌱 {t('my_fields')}</span>}
          sub="Manage your fields and crops"
          onClick={() => navigate('/farmer/fields')}
          right={<span className="muted">›</span>}
        />
      </Card>

      <button className="btn btn-danger mt" onClick={() => void logout().then(() => navigate('/login', { replace: true }))}>
        {t('logout')}
      </button>
    </div>
  );
}

function PillTone({ role }: { role: string }) {
  const t = useLocale((s) => s.t);
  return (
    <span className="pill info" style={{ textTransform: 'capitalize' }}>
      {role === 'farmer' ? t('farmer_singular') : role === 'tubewell_owner' ? t('owner_singular') : t('admin')}
    </span>
  );
}
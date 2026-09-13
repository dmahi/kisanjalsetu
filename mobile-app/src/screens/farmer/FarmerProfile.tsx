import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { fieldsApi, cropsApi, notificationsApi, type Field, type Crop } from '../../api/common';
import { apiErrorMessage } from '../../api/client';
import { PageHeader, Card, useToast, Row, ModalSheet, Segmented } from '../../components/ui';
import { useLocale, LOCALES, type Locale } from '../../store/locale.store';
import { cropLabel } from '../../hooks/useDynamicOptions';
import { getCurrentCoordinates } from '../../utils/geolocation';
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
  const [fields, setFields] = useState<Field[]>([]);
  const [cropsList, setCropsList] = useState<Crop[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [crop, setCrop] = useState('');
  const [customCrop, setCustomCrop] = useState('');
  const [saving, setSaving] = useState(false);

  const loadFields = async () => {
    try {
      const data = await fieldsApi.list();
      setFields(data || []);
    } catch {
      setFields([]);
    }
  };

  useEffect(() => {
    void loadFields();
    void cropsApi.list().then((c) => setCropsList(c || [])).catch(() => undefined);
    notificationsApi.unreadCount().then((r) => setUnread(r.count)).catch(() => undefined);
  }, []);

  const [location, setLocation] = useState('');
  const [locating, setLocating] = useState(false);

  const handleGetLocation = async () => {
    setLocating(true);
    const coords = await getCurrentCoordinates();
    setLocating(false);
    if (coords) {
      setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
      show('GPS location captured!', 'success');
    } else {
      show('Could not get GPS location', 'error');
    }
  };

  const addField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      show(t('name'), 'error');
      return;
    }
    setSaving(true);
    const finalCrop = crop === 'OTHER_WRITE_IN' ? customCrop.trim() : crop.trim();
    try {
      await fieldsApi.create({
        name: name.trim(),
        area: area ? parseFloat(area) : undefined,
        crop: finalCrop || undefined,
        location: location.trim() || undefined,
      });
      setAddOpen(false);
      setName('');
      setArea('');
      setCrop('');
      setCustomCrop('');
      setLocation('');
      void loadFields();
      show(t('created_ok'), 'success');
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

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

      <Card title={t('my_fields')} action={<button className="btn btn-sm btn-secondary" onClick={() => setAddOpen(true)}>+ {t('add_field')}</button>}>
        {fields.length === 0 ? (
          <p className="muted" style={{ fontSize: '0.85rem' }}>{t('fields_hint')}</p>
        ) : (
          fields.map((f) => (
            <Row
              key={f.id}
              title={`${f.name}${f.crop ? ` (${f.crop})` : ''}`}
              sub={`${f.area ?? 0} ${f.areaUnit ?? t('acre')}${f.location ? ` · ${f.location}` : ''}`}
              right={<span className="muted">›</span>}
              onClick={() => undefined}
            />
          ))
        )}
      </Card>

      <button className="btn btn-danger" onClick={() => void logout().then(() => navigate('/login', { replace: true }))}>
        {t('logout')}
      </button>

      <ModalSheet open={addOpen} onClose={() => setAddOpen(false)} title={t('add_field')}>
        <form onSubmit={addField}>
          <label>{t('name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Field A" autoFocus />
          <label>{t('crop')} ({t('optional')})</label>
          <select value={crop} onChange={(e) => setCrop(e.target.value)}>
            <option value="">{t('select_ph')}</option>
            {cropsList.map((c) => (
              <option key={c.id} value={c.name}>
                {cropLabel(c, locale)}
              </option>
            ))}
            <option value="OTHER_WRITE_IN">+ {t('other')}...</option>
          </select>
          {crop === 'OTHER_WRITE_IN' && (
            <input
              style={{ marginTop: 8 }}
              value={customCrop}
              onChange={(e) => setCustomCrop(e.target.value)}
              placeholder={t('crop_hint')}
            />
          )}

          <label>{t('area')} ({t('acre')})</label>
          <input inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 2" />

          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span>{t('location')} ({t('optional')})</span>
            <button
              type="button"
              className="btn btn-xs btn-secondary"
              onClick={() => void handleGetLocation()}
              disabled={locating}
            >
              {locating ? '📍 Locating...' : '📍 Use My GPS'}
            </button>
          </label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Near West Canal / GPS"
          />

          <button type="submit" className="btn btn-primary mt-lg" disabled={saving}>
            {saving ? t('loading') : t('save')}
          </button>
        </form>
      </ModalSheet>
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
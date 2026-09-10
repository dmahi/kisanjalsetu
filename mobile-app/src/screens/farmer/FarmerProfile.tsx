import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { fieldsApi, notificationsApi, type Field } from '../../api/common';
import { apiErrorMessage } from '../../api/client';
import { PageHeader, Card, useToast, Row, ModalSheet, Segmented } from '../../components/ui';
import { useLocale, LOCALES, type Locale } from '../../store/locale.store';

export default function FarmerProfile() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const locale = useLocale((s) => s.locale);
  const setLocale = useLocale((s) => s.setLocale);
  const [fields, setFields] = useState<Field[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
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
    notificationsApi.unreadCount().then((r) => setUnread(r.count)).catch(() => undefined);
  }, []);

  const addField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      show(t('name'), 'error');
      return;
    }
    setSaving(true);
    try {
      await fieldsApi.create({ name, area: area ? parseFloat(area) : undefined });
      setAddOpen(false);
      setName('');
      setArea('');
      void loadFields();
      show(t('language_updated'), 'success');
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
              title={f.name}
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
          <label>{t('area')} ({t('acre')})</label>
          <input inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 2" />
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
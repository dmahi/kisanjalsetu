import { useEffect, useState } from 'react';
import { fieldsApi, cropsApi, type Field, type Crop } from '../../api/common';
import { apiErrorMessage } from '../../api/client';
import { PageHeader, Card, useToast, Row, ModalSheet, EmptyState, Spinner } from '../../components/ui';
import { useLocale } from '../../store/locale.store';
import { cropLabel } from '../../hooks/useDynamicOptions';
import { getCurrentCoordinates } from '../../utils/geolocation';

export default function FarmerFields() {
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const locale = useLocale((s) => s.locale);
  const [fields, setFields] = useState<Field[]>([]);
  const [cropsList, setCropsList] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [crop, setCrop] = useState('');
  const [customCrop, setCustomCrop] = useState('');
  const [location, setLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadFields = async () => {
    try {
      const data = await fieldsApi.list();
      setFields(data || []);
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFields();
    void cropsApi.list().then((c) => setCropsList(c || [])).catch(() => undefined);
  }, []);

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
      <PageHeader
        title={t('my_fields')}
        subtitle="Manage your agricultural fields and crops"

      />

      <Card>
        {loading ? (
          <Spinner />
        ) : fields.length === 0 ? (
          <EmptyState
            icon="🌱"
            title={t('no_fields') || 'No Fields Registered'}
            hint={t('fields_hint') || 'Add your fields to easily request water for irrigation.'}
          />
        ) : (
          fields.map((f) => (
            <Row
              key={f.id}
              title={
                <span style={{ fontWeight: 800 }}>
                  🌱 {f.name} {f.crop ? <span className="badge-dot" style={{ background: 'var(--brand-500)', marginLeft: 6 }}>({f.crop})</span> : null}
                </span>
              }
              sub={`${f.area ?? 0} ${f.areaUnit ?? t('acre')}${f.location ? ` · 📍 ${f.location}` : ''}`}
            />
          ))
        )}
      </Card>

      <button
        className="btn-emerald-pill mt-lg"
        onClick={() => setAddOpen(true)}
      >
        + Add New Field
      </button>

      <ModalSheet open={addOpen} onClose={() => setAddOpen(false)} title={t('add_field')}>
        <form onSubmit={addField}>
          <label>{t('name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. West Farm / Chak 4" autoFocus />

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
          <input inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 2.5" />

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

import { useEffect, useState } from 'react';
import { fieldsApi, cropsApi, type Field, type Crop } from '../../api/common';
import { apiErrorMessage } from '../../api/client';
import { PageHeader, Card, useToast, Row, ModalSheet, EmptyState, Spinner } from '../../components/ui';
import { useLocale } from '../../store/locale.store';
import { cropLabel } from '../../hooks/useDynamicOptions';
import { getCurrentCoordinates } from '../../utils/geolocation';
import { triggerHaptic, triggerHapticNotification, triggerHapticSelection } from '../../utils/haptics';
import MapPinPicker from '../../components/MapPinPicker';

export default function FarmerFields() {
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const locale = useLocale((s) => s.locale);
  const [fields, setFields] = useState<Field[]>([]);
  const [cropsList, setCropsList] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);

  // View / Detail Popup State
  const [viewingField, setViewingField] = useState<Field | null>(null);

  // Add / Edit Modal State
  const [addOpen, setAddOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [crop, setCrop] = useState('');
  const [customCrop, setCustomCrop] = useState('');
  const [location, setLocation] = useState('');
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Map Picker Modal State
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

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
    triggerHaptic('light');
    const coords = await getCurrentCoordinates();
    setLocating(false);
    if (coords) {
      setLocation(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
      triggerHapticNotification('success');
      show('GPS location captured!', 'success');
    } else {
      triggerHapticNotification('error');
      show('Could not get GPS location', 'error');
    }
  };

  const openAddModal = () => {
    triggerHapticSelection();
    setEditingFieldId(null);
    setName('');
    setArea('');
    setCrop('');
    setCustomCrop('');
    setLocation('');
    setAddOpen(true);
  };

  const openEditModal = (f: Field) => {
    triggerHapticSelection();
    setViewingField(null);
    setEditingFieldId(f.id);
    setName(f.name);
    setArea(f.area ? String(f.area) : '');
    setCrop(f.crop || '');
    setCustomCrop('');
    setLocation(f.location || '');
    setAddOpen(true);
  };

  const handleDeleteField = async (fieldId: string) => {
    triggerHapticNotification('warning');
    if (!window.confirm('Are you sure you want to delete this field?')) return;
    try {
      await fieldsApi.remove(fieldId);
      triggerHapticNotification('success');
      show('Field deleted successfully', 'info');
      setViewingField(null);
      void loadFields();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      show(t('name'), 'error');
      return;
    }
    setSaving(true);
    triggerHaptic('medium');
    const finalCrop = crop === 'OTHER_WRITE_IN' ? customCrop.trim() : crop.trim();

    try {
      if (editingFieldId) {
        await fieldsApi.update(editingFieldId, {
          name: name.trim(),
          area: area ? parseFloat(area) : undefined,
          crop: finalCrop || undefined,
          location: location.trim() || undefined,
        });
        show('Field updated successfully!', 'success');
      } else {
        await fieldsApi.create({
          name: name.trim(),
          area: area ? parseFloat(area) : undefined,
          crop: finalCrop || undefined,
          location: location.trim() || undefined,
        });
        show(t('created_ok'), 'success');
      }
      triggerHapticNotification('success');
      setAddOpen(false);
      setName('');
      setArea('');
      setCrop('');
      setCustomCrop('');
      setLocation('');
      setEditingFieldId(null);
      void loadFields();
    } catch (err) {
      triggerHapticNotification('error');
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

      {loading ? (
        <Card>
          <Spinner />
        </Card>
      ) : fields.length === 0 ? (
        <Card>
          <EmptyState
            icon="🌱"
            title={t('no_fields') || 'No Fields Registered'}
            hint={t('fields_hint') || 'Add your fields to easily request water for irrigation.'}
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map((f) => (
            <div
              key={f.id}
              className="field-item-card"
              onClick={() => {
                triggerHapticSelection();
                setViewingField(f);
              }}
            >
              <div className="field-item-icon">🌱</div>
              <div className="field-item-info">
                <div className="field-item-title">
                  <span>{f.name}</span>
                  {f.crop ? (
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        background: 'var(--brand-soft)',
                        color: 'var(--brand-700)',
                        padding: '2px 8px',
                        borderRadius: 12,
                        border: '1px solid rgba(4, 106, 56, 0.15)',
                      }}
                    >
                      🌾 {f.crop}
                    </span>
                  ) : null}
                </div>
                <div className="field-item-sub">
                  <span>📐 {f.area ?? 0} {f.areaUnit ?? t('acre')}</span>
                  {f.location ? (
                    <span style={{ color: 'var(--brand-600)' }}>📍 {f.location}</span>
                  ) : null}
                </div>
              </div>
              <div className="field-item-arrow">›</div>
            </div>
          ))}
        </div>
      )}

      <button
        className="btn-emerald-pill mt-lg"
        onClick={openAddModal}
      >
        + Add New Field
      </button>

      {/* POPUP 1: FIELD DETAILS MODAL SHEET */}
      <ModalSheet
        open={Boolean(viewingField)}
        onClose={() => setViewingField(null)}
        title="Field Details"
      >
        {viewingField && (
          <div>
            <div
              style={{
                background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                border: '1px solid #a5d6a7',
              }}
            >
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0b1c12' }}>
                🌱 {viewingField.name}
              </div>
              {viewingField.crop ? (
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#046a38', marginTop: 4 }}>
                  🌾 Crop: <b>{viewingField.crop}</b>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'grid', gap: 12, fontSize: '0.92rem', color: '#2d4537' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 8 }}>
                <span>📐 Field Area:</span>
                <b>{viewingField.area ?? 0} {viewingField.areaUnit ?? 'acre'}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--line)', paddingBottom: 8 }}>
                <span>📍 Location / Pin Point:</span>
                <b>{viewingField.location || 'Not set'}</b>
              </div>

              {viewingField.location ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(viewingField.location)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-ghost"
                  style={{ borderRadius: 20, textAlign: 'center', marginTop: 4, background: '#f1f8e9', color: '#046a38' }}
                  onClick={() => triggerHaptic('light')}
                >
                  🗺️ Open in Maps
                </a>
              ) : null}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-ghost danger"
                style={{ flex: 1, color: '#d32f2f' }}
                onClick={() => handleDeleteField(viewingField.id)}
              >
                🗑️ Delete
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1.5, borderRadius: 16 }}
                onClick={() => openEditModal(viewingField)}
              >
                ✏️ Edit Field
              </button>
            </div>
          </div>
        )}
      </ModalSheet>

      {/* POPUP 2: ADD / EDIT FIELD MODAL SHEET */}
      <ModalSheet open={addOpen} onClose={() => setAddOpen(false)} title={editingFieldId ? 'Edit Field' : t('add_field')}>
        <form onSubmit={handleSaveField}>
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
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn btn-xs btn-secondary"
                onClick={() => void handleGetLocation()}
                disabled={locating}
              >
                {locating ? '📍 Locating...' : '🛰️ GPS'}
              </button>
              <button
                type="button"
                className="btn btn-xs btn-primary"
                style={{ borderRadius: 12, padding: '4px 10px', fontSize: '0.78rem' }}
                onClick={() => {
                  triggerHapticSelection();
                  setMapPickerOpen(true);
                }}
              >
                📍 Pin Point Map
              </button>
            </div>
          </label>

          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. 28.61390, 77.20900 / Near West Canal"
          />

          <button type="submit" className="btn btn-primary mt-lg" style={{ borderRadius: 18 }} disabled={saving}>
            {saving ? t('loading') : editingFieldId ? 'Update Field' : t('save')}
          </button>
        </form>
      </ModalSheet>

      {/* POPUP 3: INTERACTIVE MAP PINPOINT PICKER MODAL */}
      <ModalSheet
        open={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        title="📍 Pin Point Field Location"
      >
        <MapPinPicker
          initialLocation={location}
          onSelectLocation={(locStr) => setLocation(locStr)}
          onClose={() => setMapPickerOpen(false)}
        />
      </ModalSheet>
    </div>
  );
}


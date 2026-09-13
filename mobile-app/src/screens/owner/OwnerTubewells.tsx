import { useEffect, useState } from 'react';
import { tubewellApi, type Tubewell } from '../../api/tubewells';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { PageHeader, Card, useToast, Row, ModalSheet, EmptyState, Spinner } from '../../components/ui';
import { formatINR, rupeesToPaise, paiseToRupees } from '../../utils/formatters';

export default function OwnerTubewells() {
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [tubewells, setTubewells] = useState<Tubewell[]>([]);
  const [loading, setLoading] = useState(true);
  const selected = useSelectionStore((s) => s.ownerTubewellId);
  const setSelected = useSelectionStore((s) => s.setOwnerTubewell);
  const [createOpen, setCreateOpen] = useState(false);
  const [editFor, setEditFor] = useState<Tubewell | null>(null);
  const [settingsFor, setSettingsFor] = useState<Tubewell | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const list = await tubewellApi.mine();
      setTubewells(list || []);
    } catch {
      setTubewells([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tw = await tubewellApi.create({
        name: form.name,
        code: form.code,
        address: form.address,
        village: form.village,
        description: form.description,
      });
      if (!selected) await setSelected(tw.id);
      setCreateOpen(false);
      setForm({});
      show(t('created_ok'), 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFor) return;
    setSaving(true);
    try {
      await tubewellApi.update(editFor.id, {
        name: form.name,
        address: form.address,
        village: form.village,
        description: form.description,
      });
      setEditFor(null);
      setForm({});
      show(t('updated_ok'), 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (tw: Tubewell) => {
    setEditFor(tw);
    setForm({
      name: tw.name,
      address: tw.address ?? '',
      village: tw.village ?? '',
      description: tw.description ?? '',
    });
  };

  const removeTubewell = async (tw: Tubewell) => {
    if (!window.confirm(t('delete_confirm', { name: tw.name }))) return;
    setSaving(true);
    try {
      await tubewellApi.remove(tw.id);
      if (selected === tw.id) await setSelected(null);
      show(t('deleted_ok'), 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsFor) return;
    setSaving(true);
    try {
      const rate = parseFloat(form.rate);
      if (!rate || rate <= 0) {
        show(t('invalid_rate'), 'error');
        return;
      }
      await tubewellApi.updateSettings(settingsFor.id, {
        ratePerHourPaise: rupeesToPaise(rate),
        allowCustomerRequest: form.allowCustomerRequest !== 'no',
        maxSessionMinutes: parseInt(form.maxSession || '0', 10) || 0,
      });
      setSettingsFor(null);
      show(t('settings_saved'), 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openSettings = (tw: Tubewell) => {
    setSettingsFor(tw);
    setForm({
      rate: String(paiseToRupees(tw.settings.ratePerHourPaise)),
      allowCustomerRequest: tw.settings.allowCustomerRequest ? 'yes' : 'no',
      maxSession: String(tw.settings.maxSessionMinutes ?? 0),
    });
  };

  return (
    <div className="page">
      {toast}
      <PageHeader
        title={t('my_tubewells_count', { count: tubewells.length }) || 'My Tubewells'}
        subtitle="Manage your tubewells, pricing, and settings"
      />

      <Card>
        {loading ? (
          <Spinner />
        ) : tubewells.length === 0 ? (
          <EmptyState
            icon="🚰"
            title="No Tubewells Created Yet"
            hint={t('no_tubewells_yet_hint')}
          />
        ) : (
          tubewells.map((tw) => (
            <Row
              key={tw.id}
              title={tw.name}
              sub={`${formatINR(tw.settings.ratePerHourPaise)}/hr · ${tw.village ?? tw.address}`}
              right={
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => void setSelected(tw.id)}>
                    {selected === tw.id ? `✓ ${t('active_marker')}` : t('use')}
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(tw)}>{t('edit')}</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => openSettings(tw)}>{t('settings')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => void removeTubewell(tw)} disabled={saving}>{t('delete')}</button>
                </div>
              }
            />
          ))
        )}
      </Card>

      <button className="btn-emerald-pill mt-lg" onClick={() => setCreateOpen(true)}>
        + Create New Tubewell
      </button>

      <ModalSheet open={createOpen} onClose={() => setCreateOpen(false)} title={t('create_tubewell')}>
        <form onSubmit={create}>
          <label>{t('name')}</label>
          <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Farm Tubewell 1" />
          <label>{t('code_hint')}</label>
          <input value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. TW-01" />
          <label>{t('address')}</label>
          <input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <label>{t('village')}</label>
          <input value={form.village ?? ''} onChange={(e) => setForm({ ...form, village: e.target.value })} />
          <label>{t('description_optional')}</label>
          <input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button type="submit" className="btn btn-primary btn-lg mt" disabled={saving || !form.name || !form.code || !form.address}>
            {saving ? t('creating') : t('create_tubewell')}
          </button>
        </form>
      </ModalSheet>

      <ModalSheet open={Boolean(editFor)} onClose={() => setEditFor(null)} title={t('edit_tubewell', { name: editFor?.name ?? '' })}>
        {editFor ? (
          <form onSubmit={saveEdit}>
            <label>{t('name')}</label>
            <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label>{t('address')}</label>
            <input value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <label>{t('village')}</label>
            <input value={form.village ?? ''} onChange={(e) => setForm({ ...form, village: e.target.value })} />
            <label>{t('description_optional')}</label>
            <input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <button type="submit" className="btn btn-primary btn-lg mt" disabled={saving || !form.name || !form.address}>
              {saving ? t('updating') : t('save_changes')}
            </button>
          </form>
        ) : null}
      </ModalSheet>

      <ModalSheet open={Boolean(settingsFor)} onClose={() => setSettingsFor(null)} title={t('settings_for', { name: settingsFor?.name ?? '' })}>
        {settingsFor ? (
          <form onSubmit={saveSettings}>
            <label>{t('rate_per_hour_rupee')}</label>
            <input inputMode="decimal" value={form.rate ?? ''} onChange={(e) => setForm({ ...form, rate: e.target.value.replace(/[^0-9.]/g, '') })} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label>{t('max_session_label')}</label>
                <input inputMode="numeric" value={form.maxSession ?? ''} onChange={(e) => setForm({ ...form, maxSession: e.target.value.replace(/[^0-9]/g, '') })} />
              </div>
              <div style={{ flex: 1 }}>
                <label>{t('customer_requests')}</label>
                <select value={form.allowCustomerRequest ?? 'yes'} onChange={(e) => setForm({ ...form, allowCustomerRequest: e.target.value })}>
                  <option value="yes">{t('allowed')}</option>
                  <option value="no">{t('not_allowed')}</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg mt" disabled={saving}>
              {saving ? t('saving') : t('save_settings')}
            </button>
          </form>
        ) : null}
      </ModalSheet>
    </div>
  );
}

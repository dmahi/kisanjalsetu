import { useEffect, useState } from 'react';
import { waterSessionApi, type WaterSession } from '../../api/sessions';
import { ownerCustomerApi, type CustomerSummary } from '../../api/tubewells';
import { tubewellApi, type Tubewell } from '../../api/tubewells';
import { cropsApi, type Crop } from '../../api/common';
import type { Field } from '../../api/common';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { PageHeader, Card, Spinner, EmptyState, useToast, Row, Pill, ModalSheet } from '../../components/ui';
import { formatINR, formatDuration, formatDateTime, toLocalInput } from '../../utils/formatters';
import { enqueueOfflineOperation } from '../../lib/offlineQueue';

export default function OwnerSessions() {
  const ownerTubewellId = useSelectionStore((s) => s.ownerTubewellId);
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [sessions, setSessions] = useState<WaterSession[]>([]);
  const [tubewells, setTubewells] = useState<Tubewell[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  const [manualOpen, setManualOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    fieldId: '',
    cropId: '',
    start: toLocalInput(new Date()),
    end: toLocalInput(new Date()),
    discountType: '',
    discountValue: '',
    discountReason: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    tubewellApi.mine().then((list) => setTubewells(list || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (ownerTubewellId) {
      ownerCustomerApi.list(ownerTubewellId).then((list) => setCustomers(list || [])).catch(() => undefined);
    }
  }, [ownerTubewellId]);

  useEffect(() => {
    if (!form.customerId || !ownerTubewellId) {
      setFields([]);
      return;
    }
    let live = true;
    ownerCustomerApi
      .customerFields(form.customerId, ownerTubewellId)
      .then((list) => { if (live) setFields(list || []); })
      .catch(() => { if (live) setFields([]); });
    return () => { live = false; };
  }, [form.customerId, ownerTubewellId]);

  const load = async () => {
    if (!ownerTubewellId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await waterSessionApi.listForOwner(ownerTubewellId);
      setSessions(data || []);
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cropsApi.list().then((c) => setCrops(c || [])).catch(() => undefined);
    if (ownerTubewellId) void load();
  }, [ownerTubewellId]);

  const cancelSession = async (id: string) => {
    try {
      await waterSessionApi.cancel(id);
      show(t('session_cancelled'), 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerTubewellId) return;
    if (!form.customerId) {
      show(t('select_customer_err'), 'error');
      return;
    }
    const start = new Date(form.start);
    const end = new Date(form.end);
    if (end <= start) {
      show(t('end_after_start'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await waterSessionApi.manual({
        tubewellId: ownerTubewellId,
        customerId: form.customerId,
        fieldId: form.fieldId || undefined,
        cropId: form.cropId || undefined,
        startDatetime: start.toISOString(),
        endDatetime: end.toISOString(),
        discountType: (form.discountType as 'fixed' | 'percentage') || undefined,
        discountValue: form.discountValue ? parseFloat(form.discountValue) : undefined,
        discountReason: form.discountReason || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      setManualOpen(false);
      setForm({ ...form, customerId: '', fieldId: '', cropId: '', discountType: '', discountValue: '', discountReason: '' });
      show(t('session_recorded'), 'success');
      void load();
    } catch (err) {
      const msg = apiErrorMessage(err);
      if (/offline|network|failed to fetch/i.test(msg)) {
        await enqueueOfflineOperation(
          'manual_session',
          {
            tubewellId: ownerTubewellId,
            customerId: form.customerId,
            startDatetime: start.toISOString(),
            endDatetime: end.toISOString(),
            discountType: form.discountType || undefined,
            discountValue: form.discountValue ? parseFloat(form.discountValue) : undefined,
            idempotencyKey: crypto.randomUUID(),
          },
          crypto.randomUUID(),
        );
        show(t('offline_manual_queued'), 'info');
      } else {
        show(msg, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const tone = (s: WaterSession) =>
    s.status === 'running' ? 'info' : s.status === 'cancelled' ? 'cancelled' : s.paymentStatus === 'paid' ? 'paid' : s.paymentStatus === 'partially_paid' ? 'partial' : 'pending';

  const statusLabel = (s: WaterSession) =>
    s.status === 'cancelled'
      ? t('cancelled')
      : s.status === 'running'
        ? t('running')
        : s.paymentStatus === 'paid'
          ? t('paid')
          : s.paymentStatus === 'partially_paid'
            ? t('partially_paid')
            : t('unpaid');

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('sessions')} subtitle="Water supply records" />
      {tubewells.length > 0 ? (
        <Card>
          <label style={{ marginTop: 0 }}>{t('select_tubewell')}</label>
          <select value={ownerTubewellId ?? ''} onChange={(e) => void useSelectionStore.getState().setOwnerTubewell(e.target.value)}>
            <option value="">{t('select_ph')}</option>
            {tubewells.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Card>
      ) : null}

      {loading ? (
        <Spinner />
      ) : !ownerTubewellId ? (
        <EmptyState title={t('select_tubewell')} />
      ) : sessions.length === 0 ? (
        <EmptyState icon="💧" title={t('no_sessions')} hint="Start water from the dashboard or add a manual session." />
      ) : (
        sessions.map((s) => (
          <Card key={s.id}>
            <Row
              title={`${s.customerName ?? t('customer')}${s.status === 'running' ? ` · ${t('running').toUpperCase()}` : ''}`}
              sub={s.durationMinutes != null ? `${formatDateTime(s.startDatetime)} · ${formatDuration(s.durationMinutes)}` : formatDateTime(s.startDatetime)}
              right={
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800 }}>{formatINR(s.finalAmountPaise)}</div>
                  <Pill tone={tone(s)}>
                    {statusLabel(s).toUpperCase()}
                  </Pill>
                </div>
              }
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {s.status === 'completed' || s.status === 'running' ? (
                <button className="btn btn-sm btn-danger" onClick={() => void cancelSession(s.id)}>{t('cancel')}</button>
              ) : null}
            </div>
          </Card>
        ))
      )}

      <button className="fab" onClick={() => setManualOpen(true)} title={t('manual_session')}>+</button>

      <ModalSheet open={manualOpen} onClose={() => setManualOpen(false)} title={t('manual_session')}>
        <form onSubmit={submitManual}>
          <label>{t('customer')}</label>
          <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">{t('select_ph')}</option>
            {customers.filter((c) => c.status === 'approved').map((c) => (
              <option key={c.customerId} value={c.customerId}>{c.name} ({c.phone})</option>
            ))}
          </select>
          <label>{t('field_optional')}</label>
          <select value={form.fieldId} onChange={(e) => setForm({ ...form, fieldId: e.target.value })} disabled={fields.length === 0}>
            <option value="">— {t('none')} —</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>{f.name}{f.area ? ` (${f.area}${f.areaUnit ? f.areaUnit : ''})` : ''}</option>
            ))}
          </select>
          {fields.length === 0 ? <p className="muted" style={{ fontSize: '0.82rem' }}>{t('mafarmer_no_fields')}</p> : null}
          <label>{t('crop_optional')}</label>
          <select value={form.cropId} onChange={(e) => setForm({ ...form, cropId: e.target.value })}>
            <option value="">— {t('none')} —</option>
            {crops.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label>{t('start_time_datetime')}</label>
          <input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
          <label>{t('end_time')}</label>
          <input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label>{t('discount_type')}</label>
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
                <option value="">{t('none')}</option>
                <option value="fixed">{t('fixed')}</option>
                <option value="percentage">{t('percentage')} (%)</option>
              </select>
            </div>
            {form.discountType ? (
              <div style={{ flex: 1 }}>
                <label>{form.discountType === 'fixed' ? '₹' : '%'}</label>
                <input inputMode="decimal" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value.replace(/[^0-9.]/g, '') })} />
              </div>
            ) : null}
          </div>
          {form.discountType ? (
            <>
              <label>{t('discount_reason')}</label>
              <input value={form.discountReason} onChange={(e) => setForm({ ...form, discountReason: e.target.value })} placeholder="e.g. Recurring customer" />
            </>
          ) : null}
          <button type="submit" className="btn btn-primary btn-lg mt" disabled={submitting}>
            {submitting ? t('saving') : t('save_manual')}
          </button>
          <p className="muted" style={{ fontSize: '0.75rem' }}>
            {t('amount_calc_server')}
          </p>
        </form>
      </ModalSheet>
    </div>
  );
}
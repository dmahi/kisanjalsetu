import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { waterSessionApi, type WaterSession } from '../../api/sessions';
import { ownerPaymentsApi, type PaymentRequest } from '../../api/payments';
import { ownerCustomerApi } from '../../api/tubewells';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { PageHeader, Card, Stat, Spinner, EmptyState, useToast, Row, Pill, ModalSheet } from '../../components/ui';
import { formatINR, formatDuration, formatDateTime, toLocalInput } from '../../utils/formatters';

export default function OwnerCustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const ownerTubewellId = useSelectionStore((s) => s.ownerTubewellId);
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [sessions, setSessions] = useState<WaterSession[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [paySheet, setPaySheet] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!ownerTubewellId || !customerId) {
      setLoading(false);
      return;
    }
    try {
      const [sess, reqs, customers] = await Promise.all([
        waterSessionApi.listForOwner(ownerTubewellId, { customerId }),
        ownerPaymentsApi.requests(ownerTubewellId, 'pending'),
        ownerCustomerApi.list(ownerTubewellId),
      ]);
      setSessions(sess || []);
      setRequests((reqs || []).filter((r) => r.customerId === customerId));
      setCustomerName(customers?.find((c) => c.customerId === customerId)?.name ?? 'Customer');
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [ownerTubewellId, customerId]);

  const totals = sessions.reduce(
    (acc, s) => {
      if (s.status === 'cancelled') return acc;
      acc.minutes += s.durationMinutes ?? 0;
      acc.billed += s.finalAmountPaise;
      if (s.paymentStatus === 'paid') acc.paid += s.finalAmountPaise;
      else if (s.paymentStatus === 'partially_paid') acc.paid += s.paidAmountPaise ?? 0;
      return acc;
    },
    { minutes: 0, billed: 0, paid: 0 },
  );
  const pending = Math.max(0, totals.billed - totals.paid);

  const approveRequest = async (id: string) => {
    try {
      await ownerPaymentsApi.approveRequest(id);
      show(t('approve_ok'), 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const rejectRequest = async (id: string) => {
    try {
      await ownerPaymentsApi.rejectRequest(id);
      show(t('reject_ok'), 'info');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerTubewellId || !customerId) return;
    const amt = Math.round(parseFloat(amount) * 100);
    if (!amt || amt <= 0) {
      show(t('enter_amount'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await ownerPaymentsApi.record(ownerTubewellId, customerId, amt, method, undefined, undefined, crypto.randomUUID());
      setPaySheet(false);
      setAmount('');
      show(t('payment_of', { amount: formatINR(amt) }), 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

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
      <Link to="/owner/customers" className="btn btn-sm btn-ghost" style={{ width: 'auto' }}>← {t('cancel')}</Link>
      <PageHeader title={customerName} subtitle="Customer account & water history" />

      <div className="stat-row">
        <Stat label={t('total_water_minutes')} value={formatDuration(totals.minutes)} />
        <Stat label={t('total_billed')} value={formatINR(totals.billed)} />
      </div>
      <div className="stat-row">
        <Stat label={t('paid')} value={formatINR(totals.paid)} tone="green" />
        <Stat label={t('pending')} value={formatINR(pending)} tone={pending > 0 ? 'red' : 'green'} />
      </div>

      {requests.length > 0 ? (
        <Card title={`${t('payment_requests')} (needs confirmation)`}>
          {requests.map((r) => (
            <Row
              key={r.id}
              title={formatINR(r.amountPaise)}
              sub={`Requested ${formatDateTime(r.requestedAt)}${r.notes ? ` · ${r.notes}` : ''}`}
              right={
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => void approveRequest(r.id)}>{t('approve')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => void rejectRequest(r.id)}>{t('reject')}</button>
                </div>
              }
            />
          ))}
        </Card>
      ) : null}

      <Card title={`Water history (${sessions.length})`} action={<button className="btn btn-sm btn-primary" onClick={() => setPaySheet(true)}>{t('record_payment_btn')}</button>}>
        {loading ? (
          <Spinner />
        ) : sessions.length === 0 ? (
          <EmptyState icon="💧" title={t('no_sessions')} />
        ) : (
          sessions.map((s) => (
            <Row
              key={s.id}
              title={`${formatDateTime(s.startDatetime)}${s.endDatetime ? ` → ${new Date(s.endDatetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
              sub={s.durationMinutes != null ? formatDuration(s.durationMinutes) : `Running · ${formatINR(s.finalAmountPaise)}`}
              right={
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800 }}>{formatINR(s.finalAmountPaise)}</div>
                  <Pill tone={s.status === 'running' ? 'info' : s.paymentStatus === 'paid' ? 'paid' : s.paymentStatus === 'partially_paid' ? 'partial' : 'pending'}>
                    {statusLabel(s).toUpperCase()}
                  </Pill>
                </div>
              }
            />
          ))
        )}
      </Card>

      <ModalSheet open={paySheet} onClose={() => setPaySheet(false)} title={t('record_payment')}>
        <form onSubmit={recordPayment}>
          <label>{t('amount')} (₹)</label>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder={t('amount_hint')} autoFocus />
          <label>{t('method')}</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">{t('cash')}</option>
            <option value="upi">{t('upi')}</option>
            <option value="bank_transfer">{t('bank_transfer')}</option>
            <option value="other">{t('method_other')}</option>
          </select>
          <button type="submit" className="btn btn-primary btn-lg mt" disabled={submitting}>
            {submitting ? t('recording') : t('record_payment')}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
}
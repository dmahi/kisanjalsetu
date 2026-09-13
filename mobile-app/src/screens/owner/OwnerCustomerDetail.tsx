import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { waterSessionApi, type WaterSession } from '../../api/sessions';
import { ownerPaymentsApi, type PaymentRequest } from '../../api/payments';
import { ownerCustomerApi, tubewellApi, type Tubewell } from '../../api/tubewells';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { PageHeader, Card, Stat, Spinner, EmptyState, useToast, Row, Pill, ModalSheet, ShareButton } from '../../components/ui';
import { UserAvatar } from '../../components/UserAvatar';
import { formatINR, formatDuration, formatDateTime } from '../../utils/formatters';
import { useDynamicOptions } from '../../hooks/useDynamicOptions';
import { ChevronLeft } from 'lucide-react';

export default function OwnerCustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const ownerTubewellId = useSelectionStore((s) => s.ownerTubewellId);
  const setOwnerTubewell = useSelectionStore((s) => s.setOwnerTubewell);
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const { options: dynOptions } = useDynamicOptions(['payment_method']);
  const payMethods = dynOptions['payment_method'] || [];

  const [tubewells, setTubewells] = useState<Tubewell[]>([]);
  const [sessions, setSessions] = useState<WaterSession[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerPhoto, setCustomerPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [paySheet, setPaySheet] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (payMethods.length > 0 && !payMethods.some((m) => m.code === method)) {
      setMethod(payMethods[0].code);
    }
  }, [payMethods]);

  // Load tubewells once & ensure active selection
  useEffect(() => {
    let cancelled = false;
    tubewellApi
      .mine()
      .then(async (list) => {
        if (cancelled) return;
        setTubewells(list || []);
        const active = list?.find((t) => t.status === 'active') || list?.[0];
        const selected = ownerTubewellId && list?.some((t) => t.id === ownerTubewellId) ? ownerTubewellId : active?.id ?? null;
        if (selected && selected !== ownerTubewellId) await setOwnerTubewell(selected);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = async (twId: string, custId: string) => {
    setLoading(true);
    try {
      const [sess, reqs, customers] = await Promise.all([
        waterSessionApi.listForOwner(twId, { customerId: custId }),
        ownerPaymentsApi.requests(twId, 'pending').catch(() => []),
        ownerCustomerApi.list(twId).catch(() => []),
      ]);
      setSessions(sess || []);
      setRequests((reqs || []).filter((r) => String(r.customerId) === String(custId)));
      const found = customers?.find(
        (c) => String(c.customerId) === String(custId) || String(c.membershipId) === String(custId),
      );
      setCustomerName(found?.name ?? 'Customer');
      setCustomerPhone(found?.phone ?? '');
      setCustomerPhoto(found?.profileImage ?? null);
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ownerTubewellId && customerId) {
      void loadData(ownerTubewellId, customerId);
    } else if (!ownerTubewellId && tubewells.length > 0 && customerId) {
      const first = tubewells[0].id;
      void setOwnerTubewell(first);
      void loadData(first, customerId);
    } else {
      setLoading(false);
    }
  }, [ownerTubewellId, customerId, tubewells]);

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
      if (ownerTubewellId && customerId) void loadData(ownerTubewellId, customerId);
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const rejectRequest = async (id: string) => {
    try {
      await ownerPaymentsApi.rejectRequest(id);
      show(t('reject_ok'), 'info');
      if (ownerTubewellId && customerId) void loadData(ownerTubewellId, customerId);
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
      if (ownerTubewellId && customerId) void loadData(ownerTubewellId, customerId);
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

      <PageHeader
        title={customerName || 'Customer Account'}
        subtitle="Customer account & water session history"
        right={
          <UserAvatar
            user={{ name: customerName, profileImage: customerPhoto, role: 'farmer' }}
            size={44}
            onDark={true}
          />
        }
      />

      {loading ? (
        <Spinner />
      ) : (
        <>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <UserAvatar
                user={{ name: customerName, profileImage: customerPhoto, role: 'farmer' }}
                size={52}
                onDark={false}
              />
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--brand-900)' }}>
                  {customerName || 'Customer'}
                </div>
                {customerPhone && (
                  <div style={{ fontSize: '0.88rem', color: '#555', marginTop: 2 }}>
                    {customerPhone}
                  </div>
                )}
              </div>
            </div>
          </Card>

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

          <Card
            title={`Water history (${sessions.length})`}
            action={
              <button className="btn btn-sm btn-primary" onClick={() => setPaySheet(true)}>
                {t('record_payment_btn')}
              </button>
            }
          >
            {sessions.length === 0 ? (
              <EmptyState icon="💧" title={t('no_sessions')} />
            ) : (
              sessions.map((s) => (
                <Row
                  key={s.id}
                  title={`${formatDateTime(s.startDatetime)}${s.endDatetime ? ` → ${new Date(s.endDatetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                  sub={s.durationMinutes != null ? formatDuration(s.durationMinutes) : `Running · ${formatINR(s.finalAmountPaise)}`}
                  right={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800 }}>{formatINR(s.finalAmountPaise)}</div>
                        <Pill tone={s.status === 'running' ? 'info' : s.paymentStatus === 'paid' ? 'paid' : s.paymentStatus === 'partially_paid' ? 'partial' : 'unpaid'}>
                          {statusLabel(s).toUpperCase()}
                        </Pill>
                      </div>
                      <ShareButton
                        iconOnly
                        title={`Water Receipt - ${customerName || 'Customer'}`}
                        text={`💧 KisanJalSetu Water Receipt\nCustomer: ${customerName || 'Customer'}\nDate: ${formatDateTime(s.startDatetime)}\nDuration: ${s.durationMinutes != null ? formatDuration(s.durationMinutes) : 'Running'}\nAmount: ${formatINR(s.finalAmountPaise)}\nStatus: ${statusLabel(s).toUpperCase()}`}
                      />
                    </div>
                  }
                />
              ))
            )}
          </Card>
        </>
      )}

      <ModalSheet open={paySheet} onClose={() => setPaySheet(false)} title={t('record_payment')}>
        <form onSubmit={recordPayment}>
          <label>{t('amount')} (₹)</label>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} placeholder={t('amount_hint')} autoFocus />
          <label>{t('method')}</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {payMethods.map((m) => (
              <option key={m.code} value={m.code}>{m.label}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-primary btn-lg mt" disabled={submitting}>
            {submitting ? t('recording') : t('record_payment')}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
}
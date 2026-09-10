import { useEffect, useMemo, useState } from 'react';
import {
  paymentsApi,
  type Payment,
  type PaymentRequest,
  type LedgerResponse,
} from '../../api/payments';
import { apiErrorMessage } from '../../api/client';
import {
  PageHeader,
  Card,
  Stat,
  Spinner,
  EmptyState,
  useToast,
  Row,
  Pill,
  ModalSheet,
} from '../../components/ui';
import { formatINR, formatDate, formatDateTime } from '../../utils/formatters';
import { TubewellSwitcher } from './TubewellSwitcher';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { enqueueOfflineOperation } from '../../lib/offlineQueue';
import { useMyTubewells } from './hooks';

export default function FarmerPayments() {
  const tubewellId = useSelectionStore((s) => s.farmerTubewellId);
  const { loading: myLoading } = useMyTubewells();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pending = useMemo(() => (ledger ? Math.max(0, ledger.totals.totalBilledPaise - ledger.totals.totalPaidPaise) : 0), [ledger]);

  const load = async () => {
    if (!tubewellId) {
      setLoading(false);
      return;
    }
    try {
      const [led, reqs, pays] = await Promise.all([
        paymentsApi.ledger(tubewellId),
        paymentsApi.myRequests(tubewellId),
        paymentsApi.myPayments(tubewellId),
      ]);
      setLedger(led);
      setRequests(reqs || []);
      setPayments(pays || []);
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    void load();
  }, [tubewellId]);

  const markPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.round(parseFloat(amount) * 100);
    if (!amt || amt <= 0) {
      show(t('enter_amount'), 'error');
      return;
    }
    if (!tubewellId) return;
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await enqueueOfflineOperation(
        'payment_request',
        { tubewellId, amountPaise: amt, notes: notes || undefined },
        idempotencyKey,
      );
      show(t('request_payment'), 'success');
      setSheetOpen(false);
      setAmount('');
      setNotes('');
      setTimeout(() => void load(), 600);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('payments')} subtitle="Billing, payments and your account" />
      {tubewellId ? <Card><TubewellSwitcher /></Card> : null}
      {!tubewellId && !myLoading ? (
        <EmptyState icon="🚰" title="Select a tubewell" hint="Pick a tubewell from Home to view payments." />
      ) : null}

      {loading ? (
        <Spinner />
      ) : ledger ? (
        <>
          <div className="stat-row">
            <Stat label={t('total_billed')} value={formatINR(ledger.totals.totalBilledPaise)} />
            <Stat label={t('paid')} value={formatINR(ledger.totals.totalPaidPaise)} tone="green" />
          </div>
          <div className="stat-row">
            <Stat label={t('pending')} value={formatINR(pending)} tone={pending > 0 ? 'red' : 'green'} />
            <button className="btn btn-primary btn-lg" onClick={() => setSheetOpen(true)} style={{ flex: 1 }}>
              💵 {t('mark_paid_title')}
            </button>
          </div>

          <Card title={t('payment_requests')}>
            {requests.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>{t('no_payments')}</p>
            ) : (
              requests.map((r) => (
                <Row
                  key={r.id}
                  title={formatINR(r.amountPaise)}
                  sub={`Requested ${formatDate(r.requestedAt)}${r.notes ? ` · ${r.notes}` : ''}`}
                  right={
                    <Pill tone={r.status === 'approved' ? 'paid' : r.status === 'rejected' ? 'danger' : 'pending'}>
                      {t(r.status === 'approved' ? 'approved' : r.status === 'rejected' ? 'rejected' : 'pending')}
                    </Pill>
                  }
                />
              ))
            )}
          </Card>

          <Card title={`${t('payments')} (history)`}>
            {payments.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>{t('no_payments')}</p>
            ) : (
              payments.map((p) => (
                <Row
                  key={p.id}
                  title={formatINR(p.amountPaise)}
                  sub={`${p.paymentMethod?.toUpperCase() ?? '—'} · ${formatDateTime(p.paymentDate)}`}
                  right={<Pill tone={p.status === 'approved' ? 'paid' : p.status === 'rejected' ? 'danger' : 'pending'}>{t(p.status === 'approved' ? 'approved' : p.status === 'rejected' ? 'rejected' : 'pending')}</Pill>}
                />
              ))
            )}
          </Card>

          <Card title={t('ledger')}>
            {ledger.entries.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>{t('no_history')}</p>
            ) : (
              ledger.entries.map((e, i) => (
                <Row
                  key={i}
                  title={e.description}
                  sub={formatDate(e.date)}
                  right={
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: e.type === 'payment' ? 'var(--green)' : 'var(--ink)' }}>
                        {e.type === 'payment' ? '−' : '+'} {formatINR(e.amountPaise)}
                      </div>
                      <div className="muted" style={{ fontSize: '0.75rem' }}>Balance {formatINR(e.balancePaise)}</div>
                    </div>
                  }
                />
              ))
            )}
          </Card>
        </>
      ) : null}

      <ModalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={t('mark_paid_title')}>
        <form onSubmit={markPaid}>
          <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
            Pending amount: <b>{formatINR(pending)}</b>. The owner will confirm your payment.
          </p>
          <label>{t('amount')} (₹)</label>
          <input
            inputMode="decimal"
            placeholder="e.g. 300"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            autoFocus
          />
          <label>{t('notes')} ({t('optional')})</label>
          <input placeholder="e.g. Paid by UPI" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button type="submit" className="btn btn-primary mt-lg" disabled={submitting}>
            {submitting ? t('sending') : t('request_payment')}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
}
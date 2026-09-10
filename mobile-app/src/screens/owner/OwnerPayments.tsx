import { useEffect, useState } from 'react';
import { ownerPaymentsApi, type Payment, type PaymentRequest } from '../../api/payments';
import { ownerCustomerApi, type CustomerSummary } from '../../api/tubewells';
import { tubewellApi, type Tubewell } from '../../api/tubewells';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { PageHeader, Card, Spinner, EmptyState, useToast, Row, Pill, ModalSheet } from '../../components/ui';
import { formatINR, formatDateTime } from '../../utils/formatters';

export default function OwnerPayments() {
  const ownerTubewellId = useSelectionStore((s) => s.ownerTubewellId);
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [tubewells, setTubewells] = useState<Tubewell[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordOpen, setRecordOpen] = useState(false);
  const [form, setForm] = useState({ customerId: '', amount: '', method: 'cash', note: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    tubewellApi.mine().then((list) => setTubewells(list || [])).catch(() => undefined);
  }, []);

  const load = async () => {
    if (!ownerTubewellId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [reqs, pays, cust] = await Promise.all([
        ownerPaymentsApi.requests(ownerTubewellId),
        ownerPaymentsApi.list(ownerTubewellId),
        ownerCustomerApi.list(ownerTubewellId),
      ]);
      setRequests(reqs || []);
      setPayments(pays || []);
      setCustomers(cust || []);
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [ownerTubewellId]);

  const actOnRequest = async (id: string, action: 'approve' | 'reject') => {
    try {
      if (action === 'approve') await ownerPaymentsApi.approveRequest(id);
      else await ownerPaymentsApi.rejectRequest(id);
      show(t('request_actioned', { action: action === 'approve' ? t('approved') : t('rejected') }), 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    }
  };

  const record = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerTubewellId) return;
    const amt = Math.round(parseFloat(form.amount) * 100);
    if (!amt || amt <= 0 || !form.customerId) {
      show(t('enter_customer_amount'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      await ownerPaymentsApi.record(
        ownerTubewellId,
        form.customerId,
        amt,
        form.method,
        undefined,
        form.note || undefined,
        crypto.randomUUID(),
      );
      setRecordOpen(false);
      setForm({ customerId: '', amount: '', method: 'cash', note: '' });
      show(t('payment_of', { amount: formatINR(amt) }), 'success');
      void load();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('payments')} subtitle={pendingCount > 0 ? t('request_awaiting', { count: pendingCount }) : t('all_payments')} />
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
      ) : (
        <>
          <Card title={pendingCount > 0 ? `${t('payment_requests')} (${pendingCount})` : t('payment_requests')}>
            {requests.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>{t('no_payments')}</p>
            ) : (
              requests.map((r) => (
                <Row
                  key={r.id}
                  title={`${formatINR(r.amountPaise)} — ${r.customerName ?? ''}`}
                  sub={`Requested ${formatDateTime(r.requestedAt)}${r.notes ? ` · ${r.notes}` : ''}`}
                  right={
                    r.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => void actOnRequest(r.id, 'approve')}>{t('approve')}</button>
                        <button className="btn btn-sm btn-danger" onClick={() => void actOnRequest(r.id, 'reject')}>{t('reject')}</button>
                      </div>
                    ) : (
                      <Pill tone={r.status === 'approved' ? 'paid' : 'danger'}>{t(r.status === 'approved' ? 'approved' : 'rejected').toUpperCase()}</Pill>
                    )
                  }
                />
              ))
            )}
          </Card>

          <button className="btn btn-primary" onClick={() => setRecordOpen(true)}>{t('record_payment_btn')}</button>

          <Card title={`${t('payments')} (history)`}>
            {payments.length === 0 ? (
              <p className="muted" style={{ fontSize: '0.85rem' }}>{t('no_payments')}</p>
            ) : (
              payments.map((p) => (
                <Row
                  key={p.id}
                  title={formatINR(p.amountPaise)}
                  sub={`${p.paymentMethod?.toUpperCase() ?? 'CASH'} · ${formatDateTime(p.paymentDate)}`}
                  right={<Pill tone={p.status === 'approved' ? 'paid' : p.status === 'rejected' ? 'danger' : 'pending'}>{t(p.status === 'approved' ? 'approved' : p.status === 'rejected' ? 'rejected' : 'pending').toUpperCase()}</Pill>}
                />
              ))
            )}
          </Card>
        </>
      )}

      <ModalSheet open={recordOpen} onClose={() => setRecordOpen(false)} title={t('record_payment')}>
        <form onSubmit={record}>
          <label>{t('customer')}</label>
          <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
            <option value="">{t('select_ph')}</option>
            {customers.filter((c) => c.status === 'approved').map((c) => (
              <option key={c.customerId} value={c.customerId}>{c.name} ({c.phone})</option>
            ))}
          </select>
          <label>{t('amount')} (₹)</label>
          <input inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, '') })} placeholder={t('amount_hint')} autoFocus />
          <label>{t('method')}</label>
          <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            <option value="cash">{t('cash')}</option>
            <option value="upi">{t('upi')}</option>
            <option value="bank_transfer">{t('bank_transfer')}</option>
            <option value="other">{t('method_other')}</option>
          </select>
          <label>{t('notes')} ({t('optional')})</label>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button type="submit" className="btn btn-primary btn-lg mt" disabled={submitting}>
            {submitting ? t('recording') : t('record_payment')}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
}
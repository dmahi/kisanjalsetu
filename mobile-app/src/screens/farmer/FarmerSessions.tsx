import { useEffect, useState } from 'react';
import { waterSessionApi, type WaterSession } from '../../api/sessions';
import { apiErrorMessage } from '../../api/client';
import { PageHeader, Card, Spinner, EmptyState, useToast, Row, Pill, Segmented } from '../../components/ui';
import { formatINR, formatDuration, formatDateTime } from '../../utils/formatters';
import { TubewellSwitcher } from './TubewellSwitcher';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { useMyTubewells } from './hooks';

type Filter = 'all' | 'paid' | 'pending' | 'partial' | 'running';

export default function FarmerSessions() {
  const tubewellId = useSelectionStore((s) => s.farmerTubewellId);
  const { loading: myLoading } = useMyTubewells();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [sessions, setSessions] = useState<WaterSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!tubewellId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await waterSessionApi.listForCustomer({ tubewellId });
        if (!cancelled) setSessions(data || []);
      } catch (err) {
        if (!cancelled) show(apiErrorMessage(err), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tubewellId]);

  const filtered = sessions.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'running') return s.status === 'running';
    return s.paymentStatus === filter;
  });

  const statusTone = (s: WaterSession) =>
    s.status === 'running' ? 'info' : s.paymentStatus === 'paid' ? 'paid' : s.paymentStatus === 'partially_paid' ? 'partial' : 'pending';

  const statusLabel = (s: WaterSession) =>
    s.status === 'running'
      ? t('running')
      : s.paymentStatus === 'paid'
        ? t('paid')
        : s.paymentStatus === 'partially_paid'
          ? t('partially_paid')
          : t('pending');

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('sessions')} subtitle="Your water usage history" />
      {tubewellId ? <Card><TubewellSwitcher /></Card> : null}

      <div className="filter-bar">
        <Segmented
          options={[
            { label: t('total'), value: 'all' },
            { label: t('running'), value: 'running' },
            { label: t('paid'), value: 'paid' },
            { label: t('partially_paid'), value: 'partial' },
            { label: t('pending'), value: 'pending' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {loading && myLoading ? (
        <Spinner />
      ) : !tubewellId ? (
        <EmptyState icon="🚰" title="Select a tubewell first" hint="Open Home and pick a tubewell." />
      ) : filtered.length === 0 ? (
        <EmptyState icon="💧" title={t('no_sessions')} hint="There are no water sessions matching this filter." />
      ) : (
        filtered.map((s) => (
          <Card key={s.id}>
            <Row
              title={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {s.status === 'running' ? <span className="badge-dot" style={{ background: 'var(--green)' }} /> : null}
                  {formatDateTime(s.startDatetime)}
                </span>
              }
              sub={`Duration ${s.durationMinutes != null ? formatDuration(s.durationMinutes) : '—'}`}
              right={
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800 }}>{formatINR(s.finalAmountPaise)}</div>
                  <Pill tone={statusTone(s)}>
                    {statusLabel(s)}
                  </Pill>
                </div>
              }
            />
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: 6 }}>
              {s.cropName ? `Crop: ${s.cropName} · ` : ''}
              {s.fieldName ? `Field: ${s.fieldName} · ` : ''}
              {t('rate_per_hour')} {formatINR(s.ratePerHourPaise)}
              {s.discountAmountPaise > 0 ? ` · ${t('discount')} ${formatINR(s.discountAmountPaise)}` : ''}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
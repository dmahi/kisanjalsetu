import { useEffect, useState } from 'react';
import { ownerDashboardApi, type FullReport } from '../../api/owner';
import { tubewellApi, type Tubewell } from '../../api/tubewells';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useLocale } from '../../store/locale.store';
import { PageHeader, Card, Stat, Spinner, EmptyState, useToast, Segmented, Row, Pill } from '../../components/ui';
import { formatINR, formatDuration } from '../../utils/formatters';

type Period = 'today' | 'week' | 'month' | 'year';

export default function OwnerReports() {
  const ownerTubewellId = useSelectionStore((s) => s.ownerTubewellId);
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [tubewells, setTubewells] = useState<Tubewell[]>([]);
  const [period, setPeriod] = useState<Period>('today');
  const [report, setReport] = useState<FullReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tubewellApi.mine().then((list) => setTubewells(list || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ownerTubewellId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    ownerDashboardApi
      .report(ownerTubewellId, period)
      .then(setReport)
      .catch((err) => show(apiErrorMessage(err), 'error'))
      .finally(() => setLoading(false));
  }, [ownerTubewellId, period]);

  return (
    <div className="page">
      {toast}
      <PageHeader title={t('reports')} subtitle="Daily / monthly / yearly performance" />

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

      <Card>
        <Segmented
          options={[
            { label: t('today'), value: 'today' },
            { label: t('this_week'), value: 'week' },
            { label: t('this_month'), value: 'month' },
            { label: t('ytd'), value: 'year' },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </Card>

      {loading ? (
        <Spinner />
      ) : !ownerTubewellId ? (
        <EmptyState title={t('select_tubewell')} />
      ) : report ? (
        <>
          <div className="stat-row">
            <Stat label={t('total_water_minutes')} value={formatDuration(report.totalMinutes)} />
            <Stat label={t('sessions_plural')} value={String(report.sessionCount ?? 0)} />
          </div>
          <div className="stat-row">
            <Stat label={t('customers')} value={String(report.totalCustomers ?? 0)} />
            <Stat label={t('total_billed')} value={formatINR(report.totalBilledPaise)} />
          </div>
          <div className="stat-row">
            <Stat label={t('total_collected')} value={formatINR(report.totalCollectedPaise)} tone="green" />
            <Stat label={t('pending')} value={formatINR(report.totalPendingPaise)} tone={report.totalPendingPaise > 0 ? 'red' : 'green'} />
          </div>
          <Card>
            <Row
              title={t('export_csv')}
              sub="Download session & payment rows for this range"
              right={<button className="btn btn-sm btn-secondary">{t('download')}</button>}
            />
          </Card>
        </>
      ) : (
        <EmptyState title="Could not load report" />
      )}
    </div>
  );
}
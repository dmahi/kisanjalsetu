import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { waterSessionApi, type WaterSession } from '../../api/sessions';
import { PageHeader, Card, Spinner, EmptyState, useToast, Row, Pill } from '../../components/ui';
import { formatINR, formatDuration, formatClock, formatDateTime } from '../../utils/formatters';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useSessionTimerStore } from '../../store/sessionTimer.store';
import { useLocale } from '../../store/locale.store';
import { useMyTubewells } from './hooks';

export default function FarmerMyTubewellDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const t = useLocale((s) => s.t);
  const { tubewells } = useMyTubewells();

  const setFarmerTubewell = useSelectionStore((s) => s.setFarmerTubewell);
  const running = useSessionTimerStore((s) => s.running);
  const elapsedMs = useSessionTimerStore((s) => s.elapsedMs);
  const setRunning = useSessionTimerStore((s) => s.setRunning);

  const [sessions, setSessions] = useState<WaterSession[]>([]);
  const [loading, setLoading] = useState(true);

  const tw = tubewells.find((x) => x.tubewellId === id);
  const approved = tw?.membershipStatus === 'approved';

  useEffect(() => {
    if (!id) return;
    if (approved) void setFarmerTubewell(id);
  }, [id, approved]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const data = await waterSessionApi.listForCustomer({ tubewellId: id });
        if (cancelled) return;
        setSessions(data || []);
        reconcile(data || []);
      } catch {
        if (!cancelled) setSessions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  const reconcile = async (list: WaterSession[]) => {
    const active = list.find((s) => s.status === 'running');
    if (active) {
      if (running?.id !== active.id) {
        await setRunning({
          id: active.id,
          customerId: active.customerId,
          customerName: null,
          startDatetime: active.startDatetime,
          ratePerHourPaise: active.ratePerHourPaise,
          tubewellId: id,
        });
      }
    } else if (running && running.tubewellId === id) {
      await setRunning(null);
    }
  };

  const loadSoon = () => {
    if (!id) return Promise.resolve();
    return waterSessionApi
      .listForCustomer({ tubewellId: id })
      .then((data) => setSessions(data || []))
      .catch(() => undefined);
  };

  if (loading && !tw) return <Spinner />;

  const runningSession = sessions.find((s) => s.status === 'running') ?? null;
  const lastCompleted = sessions.find((s) => s.status === 'completed') ?? null;
  const currentBillPaise = runningSession
    ? Math.round((runningSession.ratePerHourPaise * (running?.id === runningSession.id ? elapsedMs : Date.now() - new Date(runningSession.startDatetime).getTime())) / 3600000)
    : 0;

  const sessionLabel = (s: WaterSession) =>
    s.status === 'running'
      ? t('running')
      : s.status === 'cancelled'
        ? t('cancelled')
        : s.paymentStatus === 'paid'
          ? t('paid')
          : s.paymentStatus === 'partially_paid'
            ? t('partially_paid')
            : t('pending');

  const statusTone = (s: WaterSession) =>
    s.status === 'running'
      ? 'info'
      : s.status === 'cancelled'
        ? 'cancelled'
        : s.paymentStatus === 'paid'
          ? 'paid'
          : s.paymentStatus === 'partially_paid'
            ? 'partial'
            : 'pending';

  const timeLabel = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="page">
      {toast}
      <Link to="/farmer/tubewells" className="btn btn-sm btn-ghost" style={{ width: 'auto' }}>
        ← {t('back')}
      </Link>
      <PageHeader title={tw?.name ?? t('tubewell')} subtitle={tw?.code ?? ''} />

      <Card title={t('basic_info')}>
        <Row title={t('address')} sub={tw ? `${tw.address}${tw.village ? ` · ${tw.village}` : ''}` : '—'} />
        <Row title={t('rate_per_hour')} sub={tw ? `${formatINR(tw.ratePerHour * 100)}/hr` : '—'} />
        <Row
          title={t('membership')}
          right={<Pill tone={approved ? 'paid' : tw?.membershipStatus === 'rejected' ? 'danger' : 'pending'}>{t(tw?.membershipStatus ?? 'unknown')}</Pill>}
        />
        {!approved ? (
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            {tw?.membershipStatus === 'pending' ? t('membership_pending_hint') : t('membership_not_approved_hint')}
          </p>
        ) : null}
      </Card>

      {approved ? (
        <>
          <Card title={t('water_status')}>
            {runningSession ? (
              <div className="counter" style={{ boxShadow: 'none' }}>
                <div className="counter-row">
                  <div>
                    <div style={{ fontWeight: 800 }}>{t('session_running')}</div>
                    <div className="counter-label">{t('water_running_for_you')}</div>
                  </div>
                  <Pill tone="paid">{t('running').toUpperCase()}</Pill>
                </div>
                <div className="counter-clock">{running?.id === runningSession.id ? formatClock(elapsedMs) : formatClock(Date.now() - new Date(runningSession.startDatetime).getTime())}</div>
                <div className="counter-label">{t('started_at', { time: timeLabel(runningSession.startDatetime) })}</div>
                {runningSession.fieldName ? <div className="counter-label">{t('field')}: {runningSession.fieldName}</div> : null}
                <div className="counter-row" style={{ alignItems: 'center' }}>
                  <div>
                    <div className="counter-label">{t('current_bill')}</div>
                    <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>≈ {formatINR(currentBillPaise)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {lastCompleted ? (
                  <Row
                    title={t('not_running')}
                    sub={t('last_stopped', { time: lastCompleted.endDatetime ? ` · ${timeLabel(lastCompleted.endDatetime)}` : '' })}
                    right={<Pill tone="cancelled">{t('stopped')}</Pill>}
                  />
                ) : (
                  <p className="muted" style={{ fontSize: '0.85rem' }}>{t('no_sessions_yet_hint')}</p>
                )}
                <p className="muted" style={{ fontSize: '0.85rem' }}>{t('owner_controls_water')}</p>
              </>
            )}
          </Card>

          <Card title={t('all_sessions')}>
            {loading ? (
              <Spinner />
            ) : sessions.length === 0 ? (
              <EmptyState icon="💧" title={t('no_sessions')} hint={t('no_sessions_yet_hint')} />
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="row">
                  <div>
                    <div className="row-title" style={{ fontSize: '0.9rem' }}>
                      {formatDateTime(s.startDatetime)}
                      {s.status === 'running' ? ` · ${t('running')}` : s.endDatetime ? ` → ${timeLabel(s.endDatetime)}` : ''}
                    </div>
                    <div className="row-sub">
                      {s.fieldName ? `${t('field')}: ${s.fieldName}` : ''}
                      {s.fieldName && s.cropName ? ' · ' : ''}
                      {s.cropName ? `${t('crop')}: ${s.cropName}` : ''}
                      {s.durationMinutes != null ? ` · ${formatDuration(s.durationMinutes)}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800 }}>{formatINR(s.finalAmountPaise)}</div>
                    <Pill tone={statusTone(s)}>{sessionLabel(s)}</Pill>
                  </div>
                </div>
              ))
            )}
          </Card>
        </>
      ) : (
        <EmptyState icon="⏳" title={t('membership_pending_title')} hint={t('membership_pending_hint')} />
      )}
    </div>
  );
}
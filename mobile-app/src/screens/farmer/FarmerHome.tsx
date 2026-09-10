import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentsApi, type DashboardTotals } from '../../api/payments';
import { waterSessionApi, type WaterSession } from '../../api/sessions';
import { apiErrorMessage } from '../../api/client';
import { Card, Stat, Spinner, EmptyState, PageHeader, useToast, Row, Pill } from '../../components/ui';
import { formatINR, formatDuration, formatClock, formatDateTime } from '../../utils/formatters';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useSessionTimerStore } from '../../store/sessionTimer.store';
import { useAuthStore } from '../../store/auth.store';
import { useLocale } from '../../store/locale.store';
import { TubewellSwitcher } from './TubewellSwitcher';
import { useMyTubewells } from './hooks';

export default function FarmerHome() {
  const farmerTubewellId = useSelectionStore((s) => s.farmerTubewellId);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const { tubewells } = useMyTubewells();
  const [dashboard, setDashboard] = useState<DashboardTotals | null>(null);
  const [sessions, setSessions] = useState<WaterSession[]>([]);
  const [loading, setLoading] = useState(true);

  // local live counter for the customer-run session
  const running = useSessionTimerStore((s) => s.running);
  const elapsedMs = useSessionTimerStore((s) => s.elapsedMs);
  const setRunning = useSessionTimerStore((s) => s.setRunning);

  const selectedTw = tubewells.find((tw) => tw.tubewellId === farmerTubewellId);

  useEffect(() => {
    if (!farmerTubewellId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const [dash, sess] = await Promise.all([
          paymentsApi.dashboard(farmerTubewellId),
          waterSessionApi.listForCustomer({ tubewellId: farmerTubewellId }),
        ]);
        if (cancelled) return;
        setDashboard(dash);
        setSessions((sess || []).slice(0, 5));
        reconcileRunning(sess || []);
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
  }, [farmerTubewellId]);

  // Poll while idle so an owner-stop (or start from another device) is picked up.
  useEffect(() => {
    if (!farmerTubewellId) return;
    let live = true;
    const poll = async () => {
      try {
        const sess = await waterSessionApi.listForCustomer({ tubewellId: farmerTubewellId });
        if (!live) return;
        setSessions((sess || []).slice(0, 5));
        reconcileRunning(sess || []);
      } catch {
        /* keep local counter */
      }
    };
    const id = setInterval(poll, 15000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [farmerTubewellId]);

  const reconcileRunning = async (list: WaterSession[]) => {
    const active = list.find((s) => s.status === 'running');
    if (active) {
      if (running?.id !== active.id) {
        await setRunning({
          id: active.id,
          customerId: active.customerId,
          customerName: user?.name ?? null,
          startDatetime: active.startDatetime,
          ratePerHourPaise: active.ratePerHourPaise,
          tubewellId: farmerTubewellId ?? undefined,
        });
      }
    } else if (running && (!farmerTubewellId || running.tubewellId === farmerTubewellId)) {
      await setRunning(null);
    }
  };

  if (!farmerTubewellId) {
    return (
      <div className="page">
        <PageHeader title={t('home')} />
        <Card>
          <TubewellSwitcher />
        </Card>
        <EmptyState icon="🚰" title={t('no_tubewell_selected') ?? 'No tubewell selected'} hint="Search for a tubewell and send a registration request." />
        <button className="btn btn-primary" onClick={() => navigate('/farmer/tubewells')}>
          {t('tubewells')}
        </button>
      </div>
    );
  }

  const totals = dashboard?.totals;

  const currentBillPaise = running ? Math.round((running.ratePerHourPaise * elapsedMs) / 3600000) : 0;

  const sessionLabel = (s: WaterSession) =>
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
      <PageHeader title={t('home')} subtitle={dashboard?.tubewell?.name ?? t('loading')} />
      <Card>
        <TubewellSwitcher />
      </Card>

      {running ? (
        <div className="counter mt">
          <div className="counter-row">
            <div>
              <div style={{ fontWeight: 800 }}>{selectedTw?.name ?? t('running')}</div>
              <div className="counter-label">{t('session_running')}</div>
            </div>
            <Pill tone="paid">{t('running').toUpperCase()}</Pill>
          </div>
          <div className="counter-clock">{formatClock(elapsedMs)}</div>
          <div className="counter-label">{t('started_at', { time: new Date(running.startDatetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) })}</div>
          <div className="counter-row">
            <div>
              <div className="counter-label">{t('current_bill')}</div>
              <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>
                ≈ {formatINR(currentBillPaise)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="counter mt">
          <div>
            <div style={{ fontWeight: 800 }}>{selectedTw?.name ?? ''}</div>
            <div className="counter-label">{t('no_running_session')}</div>
            <div className="counter-label" style={{ color: 'var(--ink-soft)' }}>{t('owner_controls_water')}</div>
            {(() => {
              const last = sessions.find((s) => s.status === 'completed');
              if (!last) return null;
              const ended = last.endDatetime ? ` · ${new Date(last.endDatetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : '';
              return (
                <div className="counter-label" style={{ color: 'var(--green)' }}>
                  {t('last_stopped', { time: ended })}
                  {t('last_stopped_amount', { amount: formatINR(last.finalAmountPaise) })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : totals ? (
        <>
          <div className="stat-row">
            <Stat label={t('total_water_minutes')} value={formatDuration(totals.totalMinutes)} />
            <Stat label={t('total_billed')} value={formatINR(totals.totalBilledPaise)} />
          </div>
          <div className="stat-row">
            <Stat label={t('paid')} value={formatINR(totals.totalPaidPaise)} tone="green" />
            <Stat label={t('pending')} value={formatINR(totals.totalPendingPaise)} tone={totals.totalPendingPaise > 0 ? 'red' : 'green'} />
          </div>

          <Card title={t('recent_sessions')}>
            {sessions.length === 0 ? (
              <EmptyState icon="💧" title={t('no_sessions')} hint="Your water sessions will appear here." />
            ) : (
              sessions.map((s) => (
                <Row
                  key={s.id}
                  title={`${formatDateTime(s.startDatetime)} · ${s.durationMinutes ? formatDuration(s.durationMinutes) : t('running')}`}
                  sub={`${t('rate_per_hour')} ${formatINR(s.ratePerHourPaise)}`}
                  right={
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800 }}>{formatINR(s.finalAmountPaise)}</div>
                      <Pill tone={s.status === 'running' ? 'info' : s.paymentStatus === 'paid' ? 'paid' : s.paymentStatus === 'partially_paid' ? 'partial' : 'pending'}>
                        {sessionLabel(s)}
                      </Pill>
                    </div>
                  }
                />
              ))
            )}
          </Card>
        </>
      ) : (
        <EmptyState title="Could not load dashboard" />
      )}
    </div>
  );
}
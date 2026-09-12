import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ownerDashboardApi, type OwnerDashboard } from '../../api/owner';
import { tubewellApi, type Tubewell } from '../../api/tubewells';
import { waterSessionApi } from '../../api/sessions';
import { ownerCustomerApi, type CustomerSummary } from '../../api/tubewells';
import { waterQueueApi, type WaterQueueEntry } from '../../api/queue';
import { waterTurnAlertsApi, type NextForTubewell } from '../../api/waterTurnAlerts';
import type { Field } from '../../api/common';
import { apiErrorMessage } from '../../api/client';
import { useSelectionStore } from '../../store/tubewellSelection.store';
import { useSessionTimerStore } from '../../store/sessionTimer.store';
import { useLocale } from '../../store/locale.store';
import { PageHeader, Card, Stat, Spinner, EmptyState, useToast, Row, ModalSheet, Pill } from '../../components/ui';
import { formatINR, formatDuration, formatClock, toLocalInput } from '../../utils/formatters';
import { enqueueOfflineOperation } from '../../lib/offlineQueue';

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { show, toast } = useToast();
  const t = useLocale((s) => s.t);
  const [tubewells, setTubewells] = useState<Tubewell[]>([]);
  const ownerTubewellId = useSelectionStore((s) => s.ownerTubewellId);
  const setOwnerTubewell = useSelectionStore((s) => s.setOwnerTubewell);
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  // running session timer state
  const running = useSessionTimerStore((s) => s.running);
  const elapsedMs = useSessionTimerStore((s) => s.elapsedMs);
  const setRunning = useSessionTimerStore((s) => s.setRunning);

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [creditOpen, setCreditOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldId, setFieldId] = useState('');
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [startedAt, setStartedAt] = useState(toLocalInput(new Date()));
  const [submitting, setSubmitting] = useState(false);

  // Queue state
  const [waitingQueue, setWaitingQueue] = useState<WaterQueueEntry[]>([]);
  const [manualOverride, setManualOverride] = useState(false);
  const [selectedQueueEntry, setSelectedQueueEntry] = useState<WaterQueueEntry | null>(null);

  // Water-turn alert state (next farmer + live alert)
  const [turnInfo, setTurnInfo] = useState<NextForTubewell | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [estimateMinutes, setEstimateMinutes] = useState('10');
  const [customMinutes, setCustomMinutes] = useState('60');
  const [sendingAlert, setSendingAlert] = useState(false);
  const [actingAlertId, setActingAlertId] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  // Load my tubewells once
  useEffect(() => {
    tubewellApi
      .mine()
      .then(async (list) => {
        setTubewells(list || []);
        const active = list?.find((t) => t.status === 'active');
        const selected = ownerTubewellId && list?.some((t) => t.id === ownerTubewellId) ? ownerTubewellId : active?.id ?? null;
        if (selected && selected !== ownerTubewellId) await setOwnerTubewell(selected);
        else if (selected) void setOwnerTubewell(selected);
      })
      .catch(() => undefined);
  }, []);

  // Load dashboard + reconcile running session
  useEffect(() => {
    if (!ownerTubewellId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const data = await ownerDashboardApi.dashboard(ownerTubewellId);
        if (cancelled) return;
        setDashboard(data);

        if (data.running) {
          const info = {
            id: data.running.id,
            customerId: data.running.customerId,
            customerName: data.running.customerName ?? null,
            startDatetime: data.running.startDatetime,
            ratePerHourPaise: Math.round(data.running.ratePerHour * 100),
            tubewellId: ownerTubewellId,
          };
          if (running?.id !== info.id) void setRunning(info);
        } else if (running) {
          void setRunning(null);
        }

        const turn = await waterTurnAlertsApi.next(ownerTubewellId).catch(() => null);
        if (!cancelled) setTurnInfo(turn);
      } catch (err) {
        if (!cancelled) show(apiErrorMessage(err), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ownerTubewellId]);

  // load customers when opening start modal or tab focus
  useEffect(() => {
    if (ownerTubewellId) {
      ownerCustomerApi.list(ownerTubewellId).then((list) => setCustomers(list || [])).catch(() => undefined);
    }
  }, [ownerTubewellId]);

  // load the selected customer's fields for the start-water sheet
  useEffect(() => {
    if (!customerId || !ownerTubewellId) {
      setFields([]);
      setFieldId('');
      return;
    }
    let live = true;
    setFieldsLoading(true);
    setFieldId('');
    ownerCustomerApi
      .customerFields(customerId, ownerTubewellId)
      .then((list) => { if (live) setFields(list || []); })
      .catch(() => { if (live) setFields([]); })
      .finally(() => { if (live) setFieldsLoading(false); });
    return () => { live = false; };
  }, [customerId, ownerTubewellId]);

  const handleOpenStartModal = async () => {
    setCreditOpen(true);
    setManualOverride(false);
    setStartedAt(toLocalInput(new Date()));
    if (!ownerTubewellId) return;

    try {
      const qRes = await waterQueueApi.getQueue(ownerTubewellId);
      const waiting = qRes.waiting || [];
      setWaitingQueue(waiting);

      if (waiting.length > 0) {
        const top = waiting[0];
        setSelectedQueueEntry(top);
        setCustomerId(top.customerId);
        setFieldId(top.fieldId);
      } else {
        setSelectedQueueEntry(null);
        setCustomerId('');
        setFieldId('');
      }
    } catch {
      setSelectedQueueEntry(null);
    }
  };

  const startSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerTubewellId || !customerId) {
      show(t('choose_customer'), 'error');
      return;
    }
    if (!fieldId) {
      show(t('choose_field'), 'error');
      return;
    }

    // Check manual override confirmation
    if (manualOverride && waitingQueue.length > 0) {
      const queuedItem = waitingQueue.find((q) => q.customerId === customerId);
      if (queuedItem && queuedItem.queuePosition > 1) {
        const confirmMsg = `${queuedItem.customerName || 'Farmer'} is #${queuedItem.queuePosition} in the queue. Start water for ${queuedItem.customerName || 'Farmer'} anyway?`;
        if (!window.confirm(confirmMsg)) return;
      }
    }

    setSubmitting(true);
    const idempotencyKey = crypto.randomUUID();
    const startDatetime = new Date(startedAt).toISOString();
    const customer = customers.find((c) => c.customerId === customerId);
    try {
      try {
        const session = await waterSessionApi.start({
          tubewellId: ownerTubewellId,
          customerId,
          fieldId,
          startDatetime,
          idempotencyKey,
          waterQueueEntryId: !manualOverride && selectedQueueEntry ? selectedQueueEntry.id : undefined,
          waterRequestId: !manualOverride && selectedQueueEntry ? selectedQueueEntry.waterRequestId : undefined,
        });
        await setRunning({
          id: session.id,
          customerId,
          customerName: customer?.name ?? selectedQueueEntry?.customerName ?? null,
          startDatetime: session.startDatetime,
          ratePerHourPaise: session.ratePerHourPaise,
          tubewellId: ownerTubewellId,
        });
      } catch (err) {
        // offline path — queue it and start a local counter
        await enqueueOfflineOperation('start_session', { tubewellId: ownerTubewellId, customerId, fieldId, startDatetime, idempotencyKey }, idempotencyKey);
        await setRunning({
          id: idempotencyKey,
          customerId,
          customerName: customer?.name ?? selectedQueueEntry?.customerName ?? null,
          startDatetime,
          ratePerHourPaise: tubewells.find((t) => t.id === ownerTubewellId)?.settings.ratePerHourPaise ?? 0,
          tubewellId: ownerTubewellId,
        });
        show(t('offline_started'), 'info');
      }
      setCreditOpen(false);
      setCustomerId('');
      setFieldId('');
      setSelectedQueueEntry(null);
      setManualOverride(false);
      setTimeout(() => void ownerDashboardApi.dashboard(ownerTubewellId).then(setDashboard), 400);
    } finally {
      setSubmitting(false);
    }
  };

  const stopSession = async () => {
    if (!running) return;
    setSubmitting(true);
    try {
      const session = await waterSessionApi.stop(running.id);
      await setRunning(null);
      show(t('session_stopped', { amount: formatINR(session.finalAmountPaise) }), 'success');
    } catch (err) {
      // offline queue
      const idempotencyKey = crypto.randomUUID();
      await enqueueOfflineOperation('stop_session', { id: running.id, endDatetime: new Date().toISOString() }, idempotencyKey);
      await setRunning(null);
      show(t('offline_stopped'), 'info');
    } finally {
      setSubmitting(false);
    }
  };

  // Keep the alert countdown ticking locally (payload refreshes every 30s).
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshTurn = async () => {
    if (!ownerTubewellId) return;
    try {
      setTurnInfo(await waterTurnAlertsApi.next(ownerTubewellId));
    } catch {
      /* keep last known */
    }
  };

  const handleNotifyNext = async () => {
    if (!ownerTubewellId) return;
    setSendingAlert(true);
    try {
      const estimatedRemainingMinutes =
        estimateMinutes === 'custom' ? Math.max(1, Math.min(1440, Number(customMinutes) || 60)) : Number(estimateMinutes);
      await waterTurnAlertsApi.create({ tubewellId: ownerTubewellId, estimatedRemainingMinutes });
      show('Alert sent — the farmer must answer within 5 minutes', 'success');
      setNotifyOpen(false);
      void refreshTurn();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setSendingAlert(false);
    }
  };

  const handleAlertRetry = async (id: string) => {
    setActingAlertId(id);
    try {
      await waterTurnAlertsApi.retry(id);
      show('Alert sent again to the farmer', 'success');
      void refreshTurn();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setActingAlertId(null);
    }
  };

  const handleAlertCancel = async (id: string) => {
    setActingAlertId(id);
    try {
      await waterTurnAlertsApi.cancel(id);
      show('Alert cancelled', 'success');
      void refreshTurn();
    } catch (err) {
      show(apiErrorMessage(err), 'error');
    } finally {
      setActingAlertId(null);
    }
  };

  const activeAlert = turnInfo?.alert;
  const nextFarmer = turnInfo?.next;

  const alertStatusText = () => {
    if (!activeAlert) return null;
    if (activeAlert.status === 'sent' || activeAlert.status === 'acknowledged') {
      const diff = new Date(activeAlert.responseDeadlineAt || 0).getTime() - nowTick;
      if (diff <= 0) return 'Expired — checking…';
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      return `Answer in ${m}:${s.toString().padStart(2, '0')}`;
    }
    return {
      ready: 'Farmer is READY ✅',
      not_ready: 'Farmer is NOT READY ❌',
      no_response: 'No response ⚠️',
      cancelled: 'Cancelled',
      pending: 'In progress…',
    }[activeAlert.status] || activeAlert.status;
  };

  if (!ownerTubewellId) {
    return (
      <div className="page">
        {toast}
        <PageHeader title={t('dashboard')} />
        {loading && tubewells.length === 0 ? <Spinner /> : (
          <EmptyState
            icon="🚰"
            title={t('no_tubewell_yet')}
            hint={tubewells.length === 0 ? t('create_tubewell_hint') : t('select_tubewell_hint')}
          />
        )}
        {tubewells.length > 0 ? (
          <Card>
            <label>{t('select_tubewell')}</label>
            <select value={ownerTubewellId ?? ''} onChange={(e) => void setOwnerTubewell(e.target.value)}>
              {tubewells.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Card>
        ) : (
          <button className="btn btn-primary" onClick={() => navigate('/owner/profile')}>{t('create_tubewell')}</button>
        )}
      </div>
    );
  }

  const today = dashboard?.today;
  const serverWarning = dashboard?.running?.warning ?? null;

  const currentBillPaise = running
    ? Math.round((running.ratePerHourPaise * (elapsedMs / 3600000)))
    : 0;

  return (
    <div className="page">
      {toast}
      <PageHeader
        title={t('dashboard')}
        subtitle={tubewells.find((t) => t.id === ownerTubewellId)?.name ?? ''}
        right={
          <button className="btn btn-sm btn-ghost" onClick={() => navigate('/owner/reports')}>📈 {t('reports')}</button>
        }
      />

      <Card>
        <label style={{ marginTop: 0 }}>{t('select_tubewell')}</label>
        <select value={ownerTubewellId} onChange={(e) => void setOwnerTubewell(e.target.value)}>
          {tubewells.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </Card>

      {loading ? <Spinner /> : (
        <>
          {running ? (
            <div className="counter mt">
              <div className="counter-row">
                <div>
                  <div style={{ fontWeight: 800 }}>{running.customerName ?? t('customer')}</div>
                  <div className="counter-label">{t('session_running')}</div>
                </div>
                <Pill tone="paid">{t('running').toUpperCase()}</Pill>
              </div>
              <div className="counter-clock">{formatClock(elapsedMs)}</div>
              <div className="counter-label">{t('started_at', { time: new Date(running.startDatetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) })}</div>
              <div className="counter-row" style={{ alignItems: 'center' }}>
                <div>
                  <div className="counter-label">{t('current_bill')}</div>
                  <div style={{ fontWeight: 800, fontSize: '1.25rem' }}>
                    ≈ {formatINR(currentBillPaise)}
                  </div>
                </div>
                <button className="btn btn-danger" onClick={() => void stopSession()} disabled={submitting} style={{ width: 'auto', padding: '12px 20px' }}>
                  ⏹ {t('water_stop')}
                </button>
              </div>
              {serverWarning ? (
                <div style={{ marginTop: 10, backgroundColor: 'rgba(255,255,255,0.15)', padding: '10px 12px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600 }}>
                  ⚠️ {serverWarning}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="counter mt">
              <div className="counter-row" style={{ alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{t('no_running_session')}</div>
                  <div className="counter-label">{t('start_water_hint')}</div>
                </div>
                <button className="btn btn-secondary" onClick={() => void handleOpenStartModal()} style={{ width: 'auto', padding: '12px 20px' }}>
                  ▶ {t('water_start')}
                </button>
              </div>
            </div>
          )}

          {today ? (
            <>
              <div className="stat-row">
                <Stat label={t('today_hours')} value={formatDuration(today.totalMinutes)} />
                <Stat label={t('customers')} value={String(today.customers)} />
              </div>
              <div className="stat-row">
                <Stat label={t('total_collected')} value={formatINR(today.totalCollectedPaise)} tone="green" />
                <Stat label={t('pending')} value={formatINR(today.totalPendingPaise)} tone={today.totalPendingPaise > 0 ? 'red' : 'green'} />
              </div>
            </>
          ) : null}
        </>
      )}

      {/* Next Farmer / Water Turn Alert panel */}
      {nextFarmer ? (
        <div className="mt">
        <Card title="Next Farmer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{nextFarmer.customerName || 'Farmer'}</div>
              <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 2 }}>
                {nextFarmer.fieldName ? `Field: ${nextFarmer.fieldName}` : ''}
                {nextFarmer.cropName ? ` (${nextFarmer.cropName})` : ''}
              </div>
            </div>
            <Pill tone="info">QUEUE #{nextFarmer.queuePosition}</Pill>
          </div>

          {activeAlert ? (
            <div style={{ marginTop: 12, backgroundColor: '#fff8e1', border: '1px solid #ffb300', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#e65100' }}>
                  🚨 {activeAlert.status.toUpperCase().replace('_', ' ')}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>
                  Attempt {activeAlert.attemptNumber}/{activeAlert.maxAttempts}
                </div>
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#333', marginTop: 4 }}>{alertStatusText()}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {activeAlert.status === 'not_ready' || activeAlert.status === 'no_response' ? (
                  <button
                    className="btn btn-sm btn-secondary"
                    disabled={actingAlertId === activeAlert.id}
                    onClick={() => void handleAlertRetry(activeAlert.id)}
                  >
                    🔔 Alert Again
                  </button>
                ) : null}
                {activeAlert.status === 'sent' || activeAlert.status === 'acknowledged' ? (
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={actingAlertId === activeAlert.id}
                    onClick={() => void handleAlertCancel(activeAlert.id)}
                  >
                    Cancel Alert
                  </button>
                ) : null}
                <button className="btn btn-sm btn-primary" onClick={() => void handleOpenStartModal()}>
                  ▶ Start Water
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setNotifyOpen(true)}>
                📣 Notify Next Farmer
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => void handleOpenStartModal()}>
                ▶ Start Water
              </button>
            </div>
          )}
        </Card>
        </div>
      ) : null}

      {/* Start water sheet */}
      <ModalSheet open={creditOpen} onClose={() => setCreditOpen(false)} title={t('water_start')}>
        <form onSubmit={startSession}>
          {selectedQueueEntry && !manualOverride ? (
            <div style={{ backgroundColor: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 800, color: '#1565c0', fontSize: '0.85rem' }}>
                  NEXT IN QUEUE (#1)
                </div>
                <Pill tone="paid">AUTO-SELECTED</Pill>
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', marginTop: 4 }}>
                {selectedQueueEntry.customerName || 'Farmer'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#333', marginTop: 2 }}>
                Field: <b>{selectedQueueEntry.fieldName || 'Field'}</b> {selectedQueueEntry.cropName ? `(${selectedQueueEntry.cropName})` : ''}
              </div>
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  style={{ fontSize: '0.82rem' }}
                  onClick={() => {
                    setManualOverride(true);
                    setCustomerId('');
                    setFieldId('');
                  }}
                >
                  Optional: Select Different Farmer
                </button>
              </div>
            </div>
          ) : (
            <>
              {waitingQueue.length > 0 && manualOverride ? (
                <div style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost"
                    onClick={() => {
                      setManualOverride(false);
                      const top = waitingQueue[0];
                      setSelectedQueueEntry(top);
                      setCustomerId(top.customerId);
                      setFieldId(top.fieldId);
                    }}
                  >
                    ← Back to Queue #1 ({waitingQueue[0].customerName})
                  </button>
                </div>
              ) : null}
              <label>{t('customer')}</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{t('select_customer_ph')}</option>
                {customers.filter((c) => c.status === 'approved').map((c) => (
                  <option key={c.customerId} value={c.customerId}>
                    {c.name} ({c.phone})
                  </option>
                ))}
              </select>
              {customers.filter((c) => c.status === 'approved').length === 0 ? (
                <p className="muted" style={{ fontSize: '0.82rem' }}>
                  {t('no_approved_customers')}
                </p>
              ) : null}
              <label>{t('field')}</label>
              {customerId ? (
                fieldsLoading ? (
                  <p className="muted" style={{ fontSize: '0.82rem' }}>{t('field_loading')}</p>
                ) : fields.length === 0 ? (
                  <p className="muted" style={{ fontSize: '0.82rem' }}>{t('mafarmer_no_fields')}</p>
                ) : (
                  <select value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
                    <option value="">{t('select_field_ph')}</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}{f.area ? ` (${f.area}${f.areaUnit ? f.areaUnit : ''})` : ''}
                      </option>
                    ))}
                  </select>
                )
              ) : (
                <p className="muted" style={{ fontSize: '0.82rem' }}>{t('select_customer_first')}</p>
              )}
            </>
          )}

          <label>{t('start_time_datetime')}</label>
          <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-lg mt" disabled={submitting || !customerId || !fieldId || fields.length === 0}>
            {submitting ? t('start_synced') : t('water_start')}
          </button>
        </form>
      </ModalSheet>

      {/* Notify Next Farmer sheet */}
      <ModalSheet open={notifyOpen} onClose={() => setNotifyOpen(false)} title="Notify Next Farmer">
        {nextFarmer ? (
          <div style={{ backgroundColor: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: '#1565c0', fontSize: '0.85rem' }}>
              NEXT IN QUEUE (#{nextFarmer.queuePosition})
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', marginTop: 4 }}>
              {nextFarmer.customerName || 'Farmer'}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#333', marginTop: 2 }}>
              Field: <b>{nextFarmer.fieldName || 'Field'}</b>{nextFarmer.cropName ? ` (${nextFarmer.cropName})` : ''}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: '0.85rem' }}>No farmer is waiting in the queue.</p>
        )}

        <label>Estimated time until this farmer's turn (approx.)</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {['5', '10', '15', '20', '30'].map((m) => (
            <button
              key={m}
              type="button"
              className={`btn btn-sm ${estimateMinutes === m ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setEstimateMinutes(m)}
            >
              {m} min
            </button>
          ))}
          <button
            type="button"
            className={`btn btn-sm ${estimateMinutes === 'custom' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setEstimateMinutes('custom')}
          >
            Custom
          </button>
        </div>
        {estimateMinutes === 'custom' ? (
          <input
            type="number"
            min={1}
            max={1440}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="Minutes"
          />
        ) : null}

        <p className="muted mt" style={{ fontSize: '0.82rem' }}>
          The farmer will receive a high-priority alert and must answer READY or NOT READY within 5 minutes.
          {activeAlert ? ' An alert is already active for this farmer.' : ''}
        </p>

        <button
          type="button"
          className="btn btn-primary btn-lg mt"
          disabled={sendingAlert || !nextFarmer}
          onClick={() => void handleNotifyNext()}
        >
          {sendingAlert ? 'Sending…' : '📣 Send Alert'}
        </button>
      </ModalSheet>
    </div>
  );
}